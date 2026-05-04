from abc import ABC, abstractmethod


class IGrafo(ABC):
    """
    Contract for any graph implementation in the system.
    Algorithms and services depend on this abstraction, not on concrete classes.
    """

    @abstractmethod
    def agregar_vertice(self, vertice) -> None:
        """Add a vertex to the graph."""

    @abstractmethod
    def obtener_vertice(self, identificador: str):
        """Return the vertex with the given identifier, or None if not found."""

    @abstractmethod
    def obtener_vertices(self) -> list:
        """Return all vertices in the graph."""
