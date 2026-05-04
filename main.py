from core.models.aeropuerto import Aeropuerto
from core.models.ruta import Ruta
from core.models.grafo import Grafo
from core.algorithms.dijkstra import Dijkstra
from ui.visualizador import VisualizadorGrafo


def construir_grafo_demo() -> Grafo:
    """
    Builds the 10-vertex demo graph from the original 6_grafos.py.
    Will be replaced by CargadorJson once services/ is implemented.
    """
    g = Grafo()

    a = Aeropuerto("A")
    b = Aeropuerto("B")
    c = Aeropuerto("C")
    d = Aeropuerto("D")
    e = Aeropuerto("E")
    f = Aeropuerto("F")
    h = Aeropuerto("G")
    i = Aeropuerto("H")
    j = Aeropuerto("I")
    k = Aeropuerto("J")

    a.agregar_adyacencia(Ruta(b, 4))
    a.agregar_adyacencia(Ruta(c, 2))
    a.agregar_adyacencia(Ruta(d, 7))
    b.agregar_adyacencia(Ruta(c, 1))
    b.agregar_adyacencia(Ruta(e, 5))
    b.agregar_adyacencia(Ruta(f, 3))
    c.agregar_adyacencia(Ruta(d, 2))
    c.agregar_adyacencia(Ruta(e, 8))
    c.agregar_adyacencia(Ruta(h, 6))
    d.agregar_adyacencia(Ruta(f, 4))
    d.agregar_adyacencia(Ruta(i, 3))
    e.agregar_adyacencia(Ruta(h, 2))
    e.agregar_adyacencia(Ruta(j, 6))
    f.agregar_adyacencia(Ruta(i, 1))
    f.agregar_adyacencia(Ruta(j, 7))
    f.agregar_adyacencia(Ruta(k, 5))
    h.agregar_adyacencia(Ruta(j, 3))
    h.agregar_adyacencia(Ruta(k, 9))
    i.agregar_adyacencia(Ruta(k, 2))
    i.agregar_adyacencia(Ruta(j, 4))
    j.agregar_adyacencia(Ruta(k, 1))
    j.agregar_adyacencia(Ruta(b, 8))
    k.agregar_adyacencia(Ruta(a, 6))
    k.agregar_adyacencia(Ruta(d, 3))

    for vertice in [a, b, c, d, e, f, h, i, j, k]:
        g.agregar_vertice(vertice)

    return g


if __name__ == "__main__":
    grafo = construir_grafo_demo()
    grafo.imprimir()

    visualizador = VisualizadorGrafo()
    visualizador.visualizar(grafo, "Red de Rutas — Demo")

    dijkstra = Dijkstra()
    resultado = dijkstra.ejecutar(grafo, "A", "J")

    visualizador.visualizar_ruta(grafo, resultado.camino, "Camino más corto A → J")
