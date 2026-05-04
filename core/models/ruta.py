from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from core.models.aeropuerto import Aeropuerto


class Ruta:
    """
    Represents a directed weighted edge between two airports.
    Single responsibility: hold destination and weight of one route.
    """

    def __init__(self, destino: "Aeropuerto", peso: float = 0.0):
        self.vertice_destino = destino
        self.peso = peso

    def get_peso(self) -> float:
        return self.peso

    def __repr__(self) -> str:
        return f"Ruta(→{self.vertice_destino.identificador}, peso={self.peso})"
