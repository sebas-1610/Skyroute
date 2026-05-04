class Aeropuerto:
    """
    Represents a graph vertex — an airport node with its adjacency list.
    Single responsibility: hold airport identity and outgoing routes.
    """

    def __init__(self, identificador: str):
        self.identificador = identificador
        self.adyacencias: list = []

    def agregar_adyacencia(self, ruta) -> None:
        """Append an outgoing route to the adjacency list."""
        self.adyacencias.append(ruta)

    def __repr__(self) -> str:
        return f"Aeropuerto({self.identificador})"
