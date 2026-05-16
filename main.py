"""
SkyRoute Flask Application

This module serves as the main entry point for the SkyRoute web application.
It provides:
- Flask server for the web frontend (visualizador, planificador)
- Tkinter demo mode for local graph visualization

Run modes:
    python main.py              → Flask web server (default)
    python main.py --demo       → Tkinter demo with sample graph
    python main.py --port 8000  → Custom port for Flask

SOLID Principles:
- SRP: Single entry point for all application modes
- OCP: Flask app can be extended with new blueprints without modification
"""

from fileinput import filename
import os
import sys
import argparse
from flask import Flask, send_from_directory, jsonify

from services.api_planificador import api_planificador_bp


def create_app() -> Flask:
    """
    Factory function to create and configure the Flask application.

    Returns:
        Configured Flask app instance
    """
    app = Flask(
        __name__,
        template_folder=os.path.join("ui", "web"),
        static_folder=os.path.join("ui", "web"),
    )

    app.config["JSON_SORT_KEYS"] = False
    app.config["JSONIFY_PRETTYPRINT_REGULAR"] = True

    app.register_blueprint(api_planificador_bp)

    @app.route("/")
    def index():
        return send_from_directory("ui/web", "index.html")

    @app.route("/visualizador")
    def visualizador():
        return send_from_directory("ui/web", "visualizador.html")

    @app.route("/planificador")
    def planificador():
        return send_from_directory("ui/web", "planificador.html")

    @app.route("/<path:filename>")
    def static_files(filename):
        return send_from_directory("ui/web", filename)

    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "skyroute"})

    return app


def run_demo() -> None:
    """
    Run the Tkinter demo with sample graph.

    This preserves the original demo functionality while
    the web frontend is served via Flask.
    """
    from core.models.aeropuerto import Aeropuerto
    from core.models.ruta import Ruta
    from core.models.grafo import Grafo
    from core.algorithms.dijkstra import Dijkstra
    from ui.visualizador import VisualizadorGrafo

    print("=== Running Tkinter Demo ===")
    print("Building sample graph...")

    grafo = Grafo()

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
        grafo.agregar_vertice(vertice)

    print("Graph built. Displaying...")
    visualizador = VisualizadorGrafo()
    visualizador.visualizar(grafo, "Red de Rutas — Demo")

    dijkstra = Dijkstra()
    resultado = dijkstra.ejecutar(grafo, "A", "J")

    visualizador.visualizar_ruta(grafo, resultado.camino, "Camino más corto A → J")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SkyRoute Application")
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Run Tkinter demo instead of Flask web server",
    )
    parser.add_argument(
        "--port", type=int, default=5000, help="Port for Flask server (default: 5000)"
    )
    parser.add_argument(
        "--host", default="127.0.0.1", help="Host for Flask server (default: 127.0.0.1)"
    )

    args = parser.parse_args()

    if args.demo:
        run_demo()
    else:
        app = create_app()
        print(f"Starting SkyRoute server on http://{args.host}:{args.port}")
        print("Routes:")
        print(f"  GET /              → index.html")
        print(f"  GET /visualizador → visualizador.html")
        print(f"  GET /planificador → planificador.html")
        print(f"  GET /api/health    → health check")
        print(f"  POST /api/planificar → route planner")
        app.run(host=args.host, port=args.port, debug=True)
