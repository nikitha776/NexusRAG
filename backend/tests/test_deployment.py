"""Deployment configuration must preserve origin restrictions and cloud auth."""
import os
import runpy
import unittest
from unittest.mock import patch
from pydantic import ValidationError
from app.config import Settings


class DeploymentTests(unittest.TestCase):
    def settings(self, **values):
        return Settings(_env_file=None, SUPABASE_URL='https://example.supabase.co',
                        SUPABASE_ANON_KEY='test', SUPABASE_SERVICE_KEY='test',
                        S3_ACCESS_KEY='test', S3_SECRET_KEY='test', GROQ_API_KEY='test', **values)

    def test_domains_are_exact_and_deduplicated(self):
        settings = self.settings(CORS_ORIGINS=['https://nikitha.space/', 'https://nikitha.space', 'http://localhost:3000'])
        self.assertEqual(settings.CORS_ORIGINS, ['https://nikitha.space', 'http://localhost:3000'])

    def test_wildcards_paths_and_credentials_are_rejected(self):
        for origin in ['*', 'https://*.example.com', 'https://example.com/chat',
                       'https://user:secret@example.com', 'https://example.com?test=1']:
            with self.subTest(origin=origin), self.assertRaises(ValidationError):
                self.settings(CORS_ORIGINS=[origin])

    def test_json_origins_environment(self):
        with patch.dict(os.environ, {'CORS_ORIGINS': '["https://nikitha.space"]'}):
            self.assertEqual(self.settings().CORS_ORIGINS, ['https://nikitha.space'])

    def test_provider_port_and_single_worker(self):
        with patch.dict(os.environ, {'PORT': '10000'}), patch('uvicorn.run') as run:
            runpy.run_module('app.start', run_name='__main__')
        run.assert_called_once_with('app.main:app', host='0.0.0.0', port=10000, workers=1)

    def test_health_and_cors_without_calling_external_services(self):
        from fastapi.testclient import TestClient
        from app.main import app
        # No lifespan context: this check must not initialize cloud services.
        client = TestClient(app)
        response = client.get('/api/health', headers={'Origin': 'http://localhost:3000'})
        self.assertEqual(response.json()['status'], 'ok')
        self.assertEqual(response.headers['access-control-allow-origin'], 'http://localhost:3000')
        rejected = client.options('/api/health', headers={
            'Origin': 'https://untrusted.example', 'Access-Control-Request-Method': 'GET'})
        self.assertEqual(rejected.status_code, 400)
        self.assertNotIn('access-control-allow-origin', rejected.headers)
