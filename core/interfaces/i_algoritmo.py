from abc import ABC, abstractmethod
from core.interfaces.i_grafo import IGrafo


class IAlgoritmo(ABC):
    """
    Contract for path-finding algorithms.
    Any algorithm (Dijkstra, BFS, DFS) must implement this interface
    so services can swap strategies without modification (OCP).
    """

    @abstractmethod
    def ejecutar(self, grafo: IGrafo, origen: str, destino: str | None = None) -> dict:
        """
        Execute the algorithm on the given graph.

        Args:
            grafo:   Graph to operate on.
            origen:  Starting vertex identifier.
            destino: Target vertex identifier. None for full traversals (BFS/DFS).

        Returns:
            A dict with at least 'camino' (list) and 'distancias' (dict).
        """
