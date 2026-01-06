from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = "clave_api"

@app.route('/')
def test():
    return jsonify({"message": "API en funcionamiento"})

import api.routes.Empresas
import api.routes.Profesionales
import api.routes.Servicios
import api.routes.Disponibilidades
import api.routes.Turnos
import api.routes.Clientes
import api.routes.AuthClientes
