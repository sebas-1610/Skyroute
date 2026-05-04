from core.interfaces.i_grafo import IGrafo
from core.models.aeropuerto import Aeropuerto


class Grafo(IGrafo):
    """
    Directed weighted graph backed by an adjacency list.
    Uses a dict internally for O(1) vertex lookup.

    Responsibilities: store vertices, expose graph structure.
    No algorithms, no visualization — those live in their own layers.
    """

    def __init__(self):
        self._vertices: dict[str, Aeropuerto] = {}

    # ------------------------------------------------------------------ IGrafo
    def agregar_vertice(self, vertice: Aeropuerto) -> None:
        self._vertices[vertice.identificador] = vertice

    def obtener_vertice(self, identificador: str) -> Aeropuerto | None:
        return self._vertices.get(identificador)

    def obtener_vertices(self) -> list[Aeropuerto]:
        return list(self._vertices.values())

    # ------------------------------------------------------------------ utils
    def imprimir(self) -> None:
        """Print the adjacency list to stdout — useful during development."""
        for v in self._vertices.values():
            print("*" * 27)
            print(v.identificador)
            for r in v.adyacencias:
                print(f"  → {r.vertice_destino.identificador}  (peso: {r.get_peso()})")
        print("-" * 37)
