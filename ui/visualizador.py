import networkx as nx
import matplotlib.pyplot as plt
from matplotlib.patches import Patch

from core.interfaces.i_grafo import IGrafo
from core.interfaces.i_visualizador import IVisualizador


class VisualizadorGrafo(IVisualizador):
    """
    Renders a graph using networkx + matplotlib.
    Isolated in the ui layer so core never imports visualization libraries.
    """

    def visualizar(
        self, grafo: IGrafo, titulo: str = "Visualización del Grafo"
    ) -> None:
        G_nx = self._construir_nx(grafo)
        pos = nx.spring_layout(G_nx, seed=42)
        edge_labels = nx.get_edge_attributes(G_nx, "weight")

        plt.figure(figsize=(10, 7))
        nx.draw(
            G_nx,
            pos,
            with_labels=True,
            node_color="skyblue",
            node_size=1500,
            font_size=12,
            font_weight="bold",
            arrows=True,
        )
        nx.draw_networkx_edge_labels(
            G_nx, pos, edge_labels=edge_labels, font_color="red"
        )
        plt.title(titulo, fontsize=14)
        plt.show()

    def visualizar_ruta(
        self, grafo: IGrafo, ruta: list, titulo: str = "Ruta más corta"
    ) -> None:
        G_nx = self._construir_nx(grafo)
        aristas_ruta = set(zip(ruta[:-1], ruta[1:]))

        edge_colors = [
            "red" if (u, v) in aristas_ruta else "#cccccc" for u, v in G_nx.edges()
        ]
        edge_widths = [3.5 if (u, v) in aristas_ruta else 1.0 for u, v in G_nx.edges()]
        node_colors = [
            (
                "orange"
                if n == ruta[0]
                else (
                    "lightgreen"
                    if n == ruta[-1]
                    else "#ff6b6b" if n in ruta else "skyblue"
                )
            )
            for n in G_nx.nodes()
        ]

        pos = nx.spring_layout(G_nx, seed=42)
        edge_labels = nx.get_edge_attributes(G_nx, "weight")

        plt.figure(figsize=(12, 8))
        nx.draw(
            G_nx,
            pos,
            with_labels=False,
            node_color=node_colors,
            node_size=2000,
            arrows=True,
            arrowsize=20,
            edge_color=edge_colors,
            width=edge_widths,
            connectionstyle="arc3,rad=0.1",
        )
        nx.draw_networkx_labels(
            G_nx,
            pos,
            font_size=12,
            font_weight="bold",
            bbox=dict(boxstyle="round,pad=0.3", fc="white", ec="none", alpha=0.8),
        )
        nx.draw_networkx_edge_labels(
            G_nx,
            pos,
            edge_labels=edge_labels,
            font_size=9,
            font_color="black",
            bbox=dict(boxstyle="round,pad=0.2", fc="white", ec="none", alpha=0.9),
            label_pos=0.35,
        )

        leyenda = [
            Patch(color="orange", label=f"Inicio ({ruta[0]})"),
            Patch(color="lightgreen", label=f"Destino ({ruta[-1]})"),
            Patch(color="#ff6b6b", label="Nodos en ruta"),
            Patch(color="skyblue", label="Otros nodos"),
        ]
        plt.legend(handles=leyenda, loc="upper left")
        plt.title(titulo, fontsize=14)
        plt.tight_layout()
        plt.show()

    # ---------------------------------------------------------------- private
    def _construir_nx(self, grafo: IGrafo) -> nx.DiGraph:
        G_nx = nx.DiGraph()
        for v in grafo.obtener_vertices():
            for ruta in v.adyacencias:
                G_nx.add_edge(
                    v.identificador,
                    ruta.vertice_destino.identificador,
                    weight=ruta.get_peso(),
                )
        return G_nx
