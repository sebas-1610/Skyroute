from abc import ABC, abstractmethod
from core.interfaces.i_grafo import IGrafo


class IVisualizador(ABC):
    """
    Contract for graph rendering.
    Keeps visualization dependencies (networkx, matplotlib) out of core.
    """

    @abstractmethod
    def visualizar(self, grafo: IGrafo, titulo: str = "") -> None:
        """Render the full graph."""

    @abstractmethod
    def visualizar_ruta(self, grafo: IGrafo, ruta: list, titulo: str = "") -> None:
        """Render the graph highlighting a specific path."""
