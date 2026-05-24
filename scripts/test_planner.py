import json
import sys
import os

# Ensure project root is on sys.path so 'core' package is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from core.algorithms.dfs_cobertura import _build_adjacency_graph, find_max_destinations_by_budget

with open('data/aeropuertos_final.json','r',encoding='utf-8') as f:
    full = json.load(f)
nodes = full.get('nodos')
conf = full.get('configuracion')
with open('data/red_aerea.json','r',encoding='utf-8') as f:
    red = json.load(f)
routes = red.get('rutas')

print('Nodes ids:', [n['id'] for n in nodes][:10])
print('Sample route:', routes[0])

graph = _build_adjacency_graph(routes, conf.get('aeronaves'), modo='budget', transportes_preferidos=['Avión Comercial'], incluir_secundarios=True, airports=nodes)
print('Graph keys:', list(graph.keys()))
for k,v in graph.items():
    print(k, '->', v)

print('\nCalling planner...')
res = find_max_destinations_by_budget(airports=nodes, routes=routes, origen='BOG', destino='MDE', presupuesto=1000, configuracion={'aeronaves': conf.get('aeronaves'), 'transportes_preferidos':['Avión Comercial'], 'incluir_secundarios': True}, modo='budget')
print('Result:', res)
