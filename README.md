# EthicML Lab

Laboratorio interactivo de ética aplicada al machine learning clásico. El caso BecaJusta propone evaluar un sistema universitario de recomendación de becas con datos sintéticos y defender una decisión de despliegue.

## Inicio local

Requiere Docker con Compose.

```sh
cp .env.example .env
docker compose up --build -d
```

Abre [el laboratorio](http://localhost:3000). [La documentación de la API](http://localhost:8000/docs) muestra los contratos de entrada y salida. Los puertos se pueden cambiar en `.env`. SQLite se conserva en el volumen `lab-data`. La instalación descarga dependencias. Después, las ejecuciones y los informes funcionan localmente sin claves ni servicios externos.

### Sin Docker

Requiere Python 3.13 y Node.js 24 LTS. Desde la raíz del repositorio:

```sh
python3.13 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
.venv/bin/python -m uvicorn lab.api:app --app-dir backend
```

En otra terminal:

```sh
cd frontend
npm ci
npm run dev
```

Si cambias la dirección de FastAPI, exporta `LAB_API_URL` en la terminal de Next.js. `LAB_DATABASE_URL` permite cambiar el archivo SQLite. Consulta [el ejemplo de entorno](.env.example).

## Recorrido BecaJusta

1. Abre **Escenarios** y **Explorador de datos**. Compara la adjudicación histórica con una elegibilidad de referencia basada en una política hipotética.
2. Ejecuta **Logistic Regression** en **Rendimiento**. Examina la matriz de confusión y las métricas con sus denominadores.
3. En **Equidad**, contrasta selección y errores por zona, género simulado o intersección. En **Explicabilidad**, compara importancia por permutación global y por grupo, y explora el efecto de sustituir una variable en una observación.
4. En **Laboratorio de mitigación**, selecciona la ejecución previa como línea base y cambia a **Random Forest**, excluye posibles proxies o activa una técnica de mitigación. La reponderación usa frecuencias marginales y conjuntas del entrenamiento. Fairlearn GridSearch considera el error y la paridad demográfica en entrenamiento.
5. Revisa **Privacidad y gobernanza** y **Seguridad y robustez**. Registra controles pendientes y revisa la sensibilidad de las predicciones ante ruido numérico acotado.
6. Selecciona la ejecución que quieres defender. Guarda tu **Decisión ética** y abre **Informes** para descargar Markdown o JSON, o imprimir la vista HTML.

**Modo docente** contiene objetivos, preguntas, rúbrica y restablecimiento confirmado. Es un control de presentación para una instancia local de confianza. Cada persona que pueda acceder a la API comparte la misma base de datos y puede usar sus endpoints de escritura y restablecimiento.

## Arquitectura y reproducibilidad

- `frontend/app` contiene el App Router, la navegación y la vista de informes. `frontend/components` contiene formularios, tablas y gráficas Recharts. Next.js reenvía las solicitudes de la interfaz a FastAPI.
- `backend/lab/scenarios.py` registra el escenario, su ficha y su generador. El motor actual comparte un contrato de clasificación binaria con BecaJusta. Un nuevo escenario puede declarar otras variables numéricas y rangos en el registro. El contrato conserva los campos de ID, etiquetas binarias y agrupación de este recorrido.
- `backend/lab/engine.py` separa entrenamiento y prueba antes de imputar, escalar o ajustar pesos. Los experimentos usan las mismas filas de entrenamiento y prueba, con una división 70/30 estratificada por adjudicación histórica y semilla 421. La salida registra hash del dataset, hash de IDs de prueba, versiones, hiperparámetros y opciones de mitigación.
- `backend/lab/metrics.py` calcula exactitud, precisión, sensibilidad, F1, ROC-AUC y tasas de error. Fairlearn calcula la paridad demográfica como máximo menos mínimo de las tasas de selección y odds igualadas como la mayor brecha entre VP y FP. Las reglas de soporte son umbrales didácticos de tamaño muestral, independientes del juicio ético.
- `backend/lab/api.py` y `storage.py` validan y guardan configuraciones, resultados, decisiones y gobernanza. Los informes se generan a partir de esos registros persistidos.

Genera el mismo CSV desde la raíz:

```sh
PYTHONPATH=backend .venv/bin/python -m lab.scenarios /tmp/becajusta.csv
```

El ingreso puede faltar. La distancia, el ingreso y el acceso digital se relacionan por construcción con la zona. La etiqueta histórica penaliza directamente zona rural y grupo B. La referencia usa promedio, horas e ingreso con ruido. Sus supuestos están en el generador y la ficha de datos. Los atributos sensibles, el ID y ambas etiquetas quedan fuera de las características. Los grupos se pueden utilizar en auditoría y durante el ajuste de mitigaciones.

El criterio de elección de Fairlearn GridSearch se aplica en entrenamiento. Los puntajes expresan la salida del estimador y pueden estar descalibrados, especialmente con reponderación. Los resultados del mismo conjunto de prueba son exploratorios si se usan para elegir características, modelos o umbrales. Una evaluación operativa necesitaría una muestra independiente. La prueba de robustez mide sensibilidad a ruido uniforme dentro del dominio de cada variable continua. El laboratorio cubre clasificación binaria sintética y deja pendientes regresión, explicaciones SHAP, validación externa y gestión de identidades. La evaluación de privacidad es guiada. Las explicaciones, tasas y pruebas del laboratorio no establecen causalidad, justicia ni certificación.

## Pruebas

Desde la raíz:

```sh
.venv/bin/python -m pytest -c backend/pytest.ini
docker compose config --quiet
```

Con la aplicación activa, usa una instancia de prueba o una base SQLite separada. Playwright crea experimentos y una decisión para verificar el recorrido.

```sh
cd frontend
npm run build
npx playwright install chromium
npm test
```

Se puede pasar `LAB_TEST_URL` para otro puerto y `LAB_BROWSER_CHANNEL=chrome` para Chrome instalado.

## Referencias

- [NIST AI RMF y sus funciones Govern, Map, Measure y Manage](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- [Principios de IA de la OCDE](https://oecd.ai/en/ai-principles)
- [Model Cards for Model Reporting](https://arxiv.org/abs/1810.03993)
- [Datasheets for Datasets](https://arxiv.org/abs/1803.09010)
- [Fairlearn · Evaluación](https://fairlearn.org/main/user_guide/assessment/index.html)

## Licencia

[MIT](LICENSE).
