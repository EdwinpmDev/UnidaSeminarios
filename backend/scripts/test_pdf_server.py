import subprocess
import sys
import os

def buscar_libreria(nombre, alias=None):
    resultado = subprocess.run(['ldconfig', '-p'], capture_output=True, text=True)
    salida = resultado.stdout.lower()
    variantes = [nombre.lower()] + ([alias.lower()] if alias else [])
    if any(v in salida for v in variantes):
        print(f"OK: {nombre} encontrada")
        return True
    print(f"FALTA: {nombre}")
    return False

def probar_generacion_pdf():
    try:
        from weasyprint import HTML
    except ImportError:
        print("ERROR: WeasyPrint no está instalado (pip install weasyprint)")
        return False

    ruta = '/tmp/test_weasyprint.pdf'
    try:
        HTML(string='<h1>test</h1>').write_pdf(ruta)
    except OSError as e:
        print(f"ERROR al generar PDF: {e}")
        return False

    if os.path.exists(ruta):
        os.remove(ruta)
        print(f"OK: PDF generado correctamente en {ruta} (Se borra automaticamente)")
        return True

    print("ERROR: no se generó el PDF")
    return False

if __name__ == '__main__':
    libs = [('pango', None), ('cairo', None), ('gdk-pixbuf', 'gdk_pixbuf')]
    resultados = [buscar_libreria(lib, alias) for lib, alias in libs]

    print()
    ok_pdf = probar_generacion_pdf()

    if all(resultados) and ok_pdf:
        sys.exit(0)
    sys.exit(1)