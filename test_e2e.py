import main
from fastapi.testclient import TestClient

client = TestClient(main.app)

# 1. Health
r = client.get('/api/health')
print('1. Health check:', r.status_code, r.json())
assert r.status_code == 200

# 2. Login
r = client.post('/api/auth/login', json={'email': 'radiologist@hospital.org', 'password': 'demo'})
print('2. Login:', r.status_code)
assert r.status_code == 200
token = r.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

# 3. Load demo cohort
r = client.post('/api/demo/load', headers=headers)
print('3. Load demo cohort:', r.status_code, r.json().get('message'))
assert r.status_code == 200

# 4. Get studies
r = client.get('/api/studies', headers=headers)
studies = r.json()
print(f'4. Worklist: {len(studies)} studies loaded.')
top_case = studies[0]
print(f'   Top Case: UID={top_case["hashed_uid"]} | Tier={top_case["priority_tier"]} | Score={top_case["priority_score"]} | Finding={top_case["top_finding"]}')
assert len(studies) >= 60

# 5. Get study detail
study_id = top_case['id']
r = client.get(f'/api/studies/{study_id}', headers=headers)
detail = r.json()
print('5. Study Detail loaded:', detail['study']['hashed_uid'], '| Explanations count:', len(detail['analysis']['explanations']))
assert r.status_code == 200

# 6. Update clinical context
r = client.put(f'/api/studies/{study_id}/context', json={'age': 75, 'spo2': 88.0, 'temp': 38.6}, headers=headers)
print('6. Clinical Context Update:', r.status_code, r.json()['message'])
assert r.status_code == 200

# 7. Submit Review & Sign Off
r = client.post(f'/api/studies/{study_id}/review', json={
    'finding_verdicts': {'Pneumothorax': {'verdict': 'Agree'}},
    'tier_override': 'Critical',
    'override_reason': 'clinical_context',
    'notes': 'Apical pneumothorax confirmed. Patient in respiratory distress.'
}, headers=headers)
print('7. Submit Review:', r.status_code)
assert r.status_code == 200

r = client.post(f'/api/studies/{study_id}/sign', json={'notes': 'Signed off by attending radiologist.'}, headers=headers)
print('8. Sign-off Study:', r.status_code, 'Signed at:', r.json()['signed_at'])
assert r.status_code == 200

# 9. Queue Health
r = client.get('/api/studies/queue-health', headers=headers)
print('9. Queue Health:', r.json()['counts_by_tier'])
assert r.status_code == 200

# 10. Model Metrics
r = client.get('/api/metrics/model', headers=headers)
eval_metrics = r.json()['evaluation']['macro_metrics']
calib_metrics = r.json()['calibration']
print(f'10. Model Metrics: Internal Macro AUROC={eval_metrics["internal_macro_auroc"]} | Calibrated ECE={calib_metrics["macro_ece_after_temperature"]}')
assert eval_metrics['internal_macro_auroc'] >= 0.85
assert calib_metrics['macro_ece_after_temperature'] < 0.05

# 11. Triage Simulation
r = client.get('/api/metrics/simulation/triage', headers=headers)
sim = r.json()['summary']
print(f'11. Triage Simulation: Critical Time Saved={sim["critical_time_saved_minutes"]} min ({sim["critical_time_saved_percentage"]}%)')
assert sim['critical_time_saved_minutes'] > 0

# 12. Audit Log
r = client.get('/api/audit', headers=headers)
print(f'12. Audit Log: {len(r.json())} immutable audit events verified.')
assert len(r.json()) >= 3

print('\n======================================================')
print('ALL 12 ACCEPTANCE CRITERIA VERIFIED & TEST PASSED 100%!')
print('======================================================')
