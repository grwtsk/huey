"""Synthetic endpoint fixtures; no test contacts grwtsk.com or grants access."""
from copy import deepcopy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from urllib.parse import parse_qs, urlsplit

from scripts.catalog import CatalogError, ROOT, link_for, load_json, render, validate


class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.catalog = load_json(ROOT / 'sources/catalog.yaml')
        self.service = load_json(ROOT / 'planning/source-service.json')

    def configure_fixture(self):
        # Structurally valid test values, NOT an assertion that these refs exist.
        self.service['binding'] = dict(endpoint_path='/synthetic-source-search', query_parameter='q',
            interface_version='synthetic-only-v1', kernel_commit='a'*40, host_commit='b'*40,
            verification_receipt='https://github.com/grwtsk/neurology/issues/88#issuecomment-1')
        self.catalog['entries'][0]['binding'] = dict(interface_version='synthetic-only-v1',
            verification_receipt='https://github.com/grwtsk/huey/issues/16#issuecomment-1')

    def test_current_inventory_valid_and_pending(self):
        validate(self.catalog, self.service)
        self.assertEqual(len(self.catalog['entries']), 26)
        self.assertIsNone(self.service['binding'])
        self.assertTrue(all(e['binding'] is None for e in self.catalog['entries']))

    def test_pending_produces_no_plausible_live_link(self):
        self.assertIsNone(link_for('A01', self.catalog, self.service))
        self.assertNotIn('](https://grwtsk.com', render(self.catalog, self.service))

    def test_unknown_id_fails_without_echo(self):
        with self.assertRaisesRegex(CatalogError, '^UNKNOWN_SOURCE_ID$'):
            link_for('PRIVATE_SENTINEL', self.catalog, self.service)

    def test_complete_fixture_formats_only_opaque_query(self):
        self.configure_fixture()
        url = link_for('A01', self.catalog, self.service)
        self.assertEqual(url, 'https://grwtsk.com/synthetic-source-search?q=huey.a01')
        self.assertEqual(parse_qs(urlsplit(url).query), {'q':['huey.a01']})
        self.assertIsNone(link_for('A02', self.catalog, self.service))

    def test_link_generation_does_not_mutate_authority_or_input(self):
        self.configure_fixture()
        before = deepcopy((self.catalog, self.service))
        link_for('A01', self.catalog, self.service)
        render(self.catalog, self.service)
        self.assertEqual((self.catalog,self.service), before)

    def test_source_cannot_claim_binding_without_service(self):
        self.catalog['entries'][0]['binding'] = {'interface_version':'v1', 'verification_receipt':'x'}
        with self.assertRaisesRegex(CatalogError, 'SERVICE_BINDING_REQUIRED'):
            validate(self.catalog, self.service)

    def test_partial_service_binding_cannot_claim_readiness(self):
        self.service['binding'] = {'ready': True}
        with self.assertRaises(CatalogError): validate(self.catalog, self.service)

    def test_ready_flag_is_not_a_substitute_for_receipts(self):
        self.configure_fixture()
        del self.service['binding']['verification_receipt']
        self.service['binding']['ready'] = True
        with self.assertRaises(CatalogError): validate(self.catalog, self.service)

    def test_stale_interface_rejected(self):
        self.configure_fixture()
        self.catalog['entries'][0]['binding']['interface_version']='old'
        with self.assertRaisesRegex(CatalogError,'INCOMPATIBLE_BINDING'):
            validate(self.catalog, self.service)

    def test_unsafe_origin_rejected(self):
        for origin in ['http://grwtsk.com','https://grwtsk.com.evil.test','https://user:secret@grwtsk.com','https://grwtsk.com/']:
            with self.subTest(origin=origin):
                service=deepcopy(self.service);service['reader_origin']=origin
                with self.assertRaises(CatalogError): validate(self.catalog, service)

    def test_unsafe_paths_rejected(self):
        self.configure_fixture()
        for path in ['//evil.test', '/x/../secret', '/x?token=secret', '/x#anchor', '/%2fsecret', '/a\\b', '/x\n']:
            with self.subTest(path=path):
                service=deepcopy(self.service);service['binding']['endpoint_path']=path
                with self.assertRaises(CatalogError): validate(self.catalog, service)

    def test_parameters_cannot_smuggle_credentials(self):
        self.configure_fixture()
        for parameter in ['access_token','grant','authorization','q&token','key','']:
            with self.subTest(parameter=parameter):
                service=deepcopy(self.service);service['binding']['query_parameter']=parameter
                with self.assertRaises(CatalogError): validate(self.catalog, service)

    def test_alias_must_be_fixed_opaque_plan_id(self):
        for alias in ['full private quote', 'huey.a01&token=x', 'https://evil.test', 'huey.e02']:
            with self.subTest(alias=alias):
                catalog=deepcopy(self.catalog);catalog['entries'][0]['query_alias']=alias
                with self.assertRaises(CatalogError): validate(catalog, self.service)

    def test_metadata_disallows_private_payload_fields(self):
        for field in ['title','body','filename','source_sha256','grant','record_ids']:
            with self.subTest(field=field):
                catalog=deepcopy(self.catalog);catalog['entries'][0][field]='PRIVATE_SENTINEL'
                with self.assertRaisesRegex(CatalogError, '^INVALID_FIELDS$'): validate(catalog, self.service)

    def test_missing_and_duplicate_sources_rejected(self):
        catalog=deepcopy(self.catalog);catalog['entries'].pop()
        with self.assertRaises(CatalogError):validate(catalog,self.service)
        catalog=deepcopy(self.catalog);catalog['entries'][-1]=deepcopy(catalog['entries'][0])
        with self.assertRaises(CatalogError):validate(catalog,self.service)

    def test_unknown_and_duplicate_chapters_rejected(self):
        for chapters in [['C99'],['C01','C01'],['PRIVATE_SENTINEL'],[]]:
            with self.subTest(chapters=chapters):
                catalog=deepcopy(self.catalog);catalog['entries'][0]['chapters']=chapters
                with self.assertRaises(CatalogError):validate(catalog,self.service)

    def test_schema_version_does_not_accept_true(self):
        self.catalog['schema_version']=True
        with self.assertRaises(CatalogError):validate(self.catalog,self.service)

    def test_no_arbitrary_dependency_or_receipt_host(self):
        self.service['dependencies'][0]['issue']='https://evil.test/1'
        with self.assertRaises(CatalogError):validate(self.catalog,self.service)
        self.setUp(); self.configure_fixture()
        self.service['binding']['verification_receipt']='https://github.com/evil/repo/issues/1#issuecomment-1'
        with self.assertRaises(CatalogError):validate(self.catalog,self.service)

    def test_rendering_deterministic_and_all_chapters_resolve(self):
        text=render(self.catalog,self.service)
        catalog=deepcopy(self.catalog);catalog['entries'].reverse()
        self.assertEqual(text,render(catalog,self.service))
        self.assertIn('[C16](https://github.com/grwtsk/huey/issues/52)',text)
        self.assertEqual(text,(ROOT/'planning/source-coverage.md').read_text())

    def test_derived_input_cannot_be_promoted_to_documentary_family(self):
        for sid in ['E01', 'D01']:
            with self.subTest(source_id=sid):
                catalog=deepcopy(self.catalog)
                next(e for e in catalog['entries'] if e['source_id']==sid)['kind']='documentary_family'
                with self.assertRaisesRegex(CatalogError, 'SOURCE_CLASS_CHANGED'):
                    validate(catalog,self.service)

    def test_response_variants_are_one_unbound_family(self):
        family=[e for e in self.catalog['entries'] if e['source_id']=='D06']
        self.assertEqual(len(family),1)
        self.assertEqual(family[0]['kind'],'documentary_family')
        self.assertIsNone(family[0]['binding'])

    def test_loader_rejects_duplicate_keys_nonfinite_and_oversize(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'input.json'
            for data in ['{"a":1,"a":2}','{"a":NaN}','x'*1_000_001]:
                path.write_text(data)
                with self.assertRaises(CatalogError):load_json(path)

    def test_cli_validate_and_pending_link_are_read_only(self):
        before=(ROOT/'sources/catalog.yaml').read_bytes()
        for args,code,message in [(['validate'],0,'CATALOG_VALID'),(['check'],0,'LEDGER_CURRENT'),(['link','A01'],3,'PENDING_SERVICE_OR_BINDING')]:
            p=subprocess.run([sys.executable,str(ROOT/'scripts/catalog.py'),*args],capture_output=True,text=True)
            self.assertEqual(p.returncode,code,p.stderr)
            self.assertIn(message,p.stdout)
        self.assertEqual(before,(ROOT/'sources/catalog.yaml').read_bytes())

    def test_cli_drift_and_malformed_do_not_echo_payload(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'fixture.txt';path.write_text('PRIVATE_SENTINEL')
            for command,flag in [('check','--ledger'),('validate','--catalog')]:
                p=subprocess.run([sys.executable,str(ROOT/'scripts/catalog.py'),command,flag,str(path)],capture_output=True,text=True)
                self.assertNotEqual(p.returncode,0)
                self.assertNotIn('PRIVATE_SENTINEL',p.stdout+p.stderr)


if __name__=='__main__':
    unittest.main()
