import math
from dataclasses import dataclass, field
from core.interfaces.i_algoritmo import IAlgoritmo
from core.interfaces.i_grafo import IGrafo


@dataclass
class ResultadoDijkstra:
    """Value object that carries all outputs of a Dijkstra execution."""

    camino: list[str]
    distancias: dict[str, float]
    predecesores: dict[str, str | None]


class Dijkstra(IAlgoritmo):
    """
    Classic Dijkstra shortest-path algorithm.

    Applicability: single-source shortest path on a directed graph with
    non-negative weights — matches the project's route cost model exactly.
    Time complexity: O(V²) with the current min-scan over a set.
    Can be upgraded to O((V + E) log V) with a priority queue when needed.
    """

    def ejecutar(
        self,
        grafo: IGrafo,
        origen: str,
        destino: str | None = None,
    ) -> ResultadoDijkstra:
        """
        Run Dijkstra from origen. Stops early if destino is reached.

        Args:
            grafo:   Any IGrafo implementation.
            origen:  Starting vertex identifier.
            destino: Optional target vertex. If None, computes full SSSP.

        Returns:
            ResultadoDijkstra with the shortest path, distances, and predecessors.
        """
        ids = [v.identificador for v in grafo.obtener_vertices()]
        dist = {v: math.inf for v in ids}
        pred: dict[str, str | None] = {v: None for v in ids}
        dist[origen] = 0
        no_visitados = set(ids)

        self._log_estado_inicial(ids, dist, pred)

        while no_visitados:
            u = min(no_visitados, key=lambda v: dist[v])
            if dist[u] == math.inf:
                break

            print(f"Procesando {u}  distancia acumulada: {dist[u]}")
            no_visitados.remove(u)

            if destino and u == destino:
                print(f"\nDestino {destino} alcanzado.\n")
                break

            vertice = grafo.obtener_vertice(u)
            for ruta in vertice.adyacencias:
                v = ruta.vertice_destino.identificador
                if v not in no_visitados:
                    continue
                nueva_dist = dist[u] + ruta.get_peso()
                if nueva_dist < dist[v]:
                    dist[v] = nueva_dist
                    pred[v] = u
                    print(f"  Relajado {v}: viene de {u}, costo = {nueva_dist}")

            self._log_etiquetas(ids, dist, pred)

        camino = self._reconstruir_camino(pred, origen, destino or origen)
        print(f"\nCamino: {' → '.join(camino)}")
        print(f"Distancia total: {dist.get(destino or origen, 0)}\n")
        return ResultadoDijkstra(camino=camino, distancias=dist, predecesores=pred)

    # ---------------------------------------------------------------- private
    def _reconstruir_camino(self, pred: dict, origen: str, destino: str) -> list[str]:
        camino: list[str] = []
        actual: str | None = destino
        while actual is not None:
            camino.insert(0, actual)
            actual = pred[actual]
        if camino and camino[0] != origen:
            return []  # destino unreachable
        return camino

    def _log_estado_inicial(self, ids, dist, pred) -> None:
        print("=== Estado inicial ===")
        for v in ids:
            costo = "∞" if dist[v] == math.inf else dist[v]
            print(f"  {v}: ({costo}, {pred[v]})")
        print()

    def _log_etiquetas(self, ids, dist, pred) -> None:
        print("  Etiquetas actuales:")
        for v in ids:
            costo = "∞" if dist[v] == math.inf else dist[v]
            print(f"    {v}: ({costo}, {pred[v]})")
        print()
