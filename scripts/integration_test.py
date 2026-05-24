import json
import requests

BASE = 'http://127.0.0.1:5000'

with open('data/aeropuertos_final.json', 'r', encoding='utf-8') as f:
    full = json.load(f)

with open('data/red_aerea.json', 'r', encoding='utf-8') as f:
    red = json.load(f)

nodes = full.get('nodos')
conf = full.get('configuracion')
routes = red.get('rutas')

payload = {
    'origen': 'BOG',
    'destino': 'MDE',
    'modo': 'budget',
    'presupuesto': 1000,
    'airports': nodes,
    'routes': routes,
    'configuracion': conf,
    'criterios': ['costo', 'distancia'],
    'transportes': ['Avión Comercial'],
    'incluir_secundarios': True,
}

print('Posting to /api/planificar...')
resp = requests.post(BASE + '/api/planificar', json=payload)
print('Status:', resp.status_code)
print(resp.text)
