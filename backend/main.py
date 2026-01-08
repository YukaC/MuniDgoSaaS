from api import app

# Para desarrollo:
# use_reloader=False evita el bug de Python 3.13 con threading
if __name__ == "__main__":
    app.run(debug=True, port=5000, use_reloader=False)