"""Search must retain ownership filters and paginate merged matches correctly."""
import re
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api import search
from app.api.deps import get_current_user

OWNER = '00000000-0000-0000-0000-000000000001'
WORKSPACE = '00000000-0000-0000-0000-000000000002'


def message(index, owner=OWNER, workspace_id=WORKSPACE):
    return {'id': f'm{index}', 'role': 'assistant', 'content': 'Before ' * 50 + 'Python evidence ' + 'after ' * 50,
            'created_at': f'2026-01-{index:02}T00:00:00+00:00',
            'chat_sessions': {'id': 's1', 'title': 'Research', 'workspace_id': workspace_id,
                             'workspaces': {'id': workspace_id, 'name': 'Science', 'user_id': owner}}}


def title(index, owner=OWNER, workspace_id=WORKSPACE):
    return {'id': f's{index}', 'title': f'Python chat {index}', 'workspace_id': workspace_id,
            'updated_at': f'2026-01-{index:02}T00:00:00+00:00',
            'workspaces': {'id': workspace_id, 'name': 'Science', 'user_id': owner}}


def builder(rows):
    query = MagicMock()
    for method in ('select', 'eq', 'filter', 'order', 'range'):
        getattr(query, method).return_value = query
    def execute():
        current = sorted(rows, key=lambda row: (row.get('created_at', row.get('updated_at')), row['id']), reverse=True)
        start, end = query.range.call_args.args
        return SimpleNamespace(data=current[start:end+1])
    query.execute.side_effect = execute
    return query


class SearchTests(unittest.TestCase):
    def test_owner_and_optional_workspace_filters_are_applied_in_both_queries(self):
        messages, titles = builder([message(1)]), builder([title(2)])
        db = MagicMock()
        db.table.side_effect = lambda name: messages if name == 'chat_messages' else titles
        with patch.object(search, 'get_supabase_admin', return_value=db):
            result = search.search_saved_chats(OWNER, 'Python', WORKSPACE, 0, 0, 20)
        self.assertEqual(len(result['results']), 2)
        self.assertIn(unittest.mock.call('chat_sessions.workspaces.user_id', OWNER), messages.eq.call_args_list)
        self.assertIn(unittest.mock.call('chat_sessions.workspace_id', WORKSPACE), messages.eq.call_args_list)
        self.assertIn(unittest.mock.call('workspaces.user_id', OWNER), titles.eq.call_args_list)
        self.assertIn(unittest.mock.call('workspace_id', WORKSPACE), titles.eq.call_args_list)
        self.assertIn('!inner', messages.select.call_args.args[0])
        self.assertIn('Python evidence', result['results'][1]['snippet'])
        self.assertLessEqual(len(result['results'][1]['snippet']), 282)

    def test_foreign_or_out_of_scope_results_are_excluded_even_if_returned_by_database(self):
        messages, titles = builder([message(2, owner='foreign'), message(1, workspace_id='other')]), builder([title(2, owner='foreign')])
        db = MagicMock()
        db.table.side_effect = lambda name: messages if name == 'chat_messages' else titles
        with patch.object(search, 'get_supabase_admin', return_value=db):
            self.assertEqual(search.search_saved_chats(OWNER, 'Python', WORKSPACE, 0, 0, 20), {'results': [], 'next': None})

    def test_pages_merge_titles_and_messages_without_skipping_or_repeating_hits(self):
        messages, titles = builder([message(i) for i in (1, 3, 5, 7)]), builder([title(i) for i in (2, 4, 6)])
        db = MagicMock()
        db.table.side_effect = lambda name: messages if name == 'chat_messages' else titles
        cursor = {'messages': 0, 'titles': 0}
        ids = []
        with patch.object(search, 'get_supabase_admin', return_value=db):
            for _ in range(5):
                page = search.search_saved_chats(OWNER, 'Python', None, cursor['messages'], cursor['titles'], 2)
                ids += [hit['id'] for hit in page['results']]
                cursor = page['next']
                if cursor is None:
                    break
        self.assertEqual(ids, ['message:m7', 'title:s6', 'message:m5', 'title:s4', 'message:m3', 'title:s2', 'message:m1'])
        self.assertIsNone(cursor)
        for call in messages.range.call_args_list + titles.range.call_args_list:
            self.assertEqual(call.args[1] - call.args[0], 2)

    def test_punctuation_is_escaped_for_literal_matching(self):
        messages, titles = builder([]), builder([])
        db = MagicMock()
        db.table.side_effect = lambda name: messages if name == 'chat_messages' else titles
        term = 'C++ (test).* 50%_'
        with patch.object(search, 'get_supabase_admin', return_value=db):
            search.search_saved_chats(OWNER, term, None, 0, 0, 20)
        messages.filter.assert_called_once_with('content', 'imatch', re.escape(term))
        titles.filter.assert_called_once_with('title', 'imatch', re.escape(term))

    def test_search_endpoint_requires_authentication_and_validates_input(self):
        app = FastAPI()
        app.include_router(search.router, prefix='/api')
        client = TestClient(app)
        self.assertEqual(client.get('/api/chat/search', params={'q': 'Python'}).status_code, 401)
        app.dependency_overrides[get_current_user] = lambda: {'id': OWNER}
        for params in ({'q': ' '}, {'q': 'x'}, {'q': 'x' * 201}, {'q': 'hi', 'limit': 1000}, {'q': 'hi', 'message_offset': -1}, {'q': 'hi', 'workspace_id': 'invalid'}):
            with patch.object(search, 'search_saved_chats') as query:
                self.assertEqual(client.get('/api/chat/search', params=params).status_code, 422)
            query.assert_not_called()

    def test_database_failures_return_safe_retryable_error(self):
        app = FastAPI()
        app.include_router(search.router, prefix='/api')
        app.dependency_overrides[get_current_user] = lambda: {'id': OWNER}
        with patch.object(search, 'search_saved_chats', side_effect=RuntimeError('private database details')):
            response = TestClient(app).get('/api/chat/search', params={'q': 'Python'})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('private', response.text)
        self.assertIn('retry', response.text)
