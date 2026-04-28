# AGENTS

## Fuente de verdad

Este archivo es la fuente principal de contexto funcional y operativo de Recipes para agentes.

`manifest.json` describe instalacion, servicios, stack, scripts y metadata. No es una lista exhaustiva de capacidades visibles para el usuario.

Las skills y scripts son herramientas internas del agente. Pueden usarse para cumplir tareas del usuario, pero no deben presentarse como interfaz de usuario normal.

## Identidad del producto

Recipes es una aplicacion local de recetas para una sola persona.

Su objetivo es ayudar al usuario a mantener un recetario local con ingredientes estructurados, pasos ordenados, categorias, favoritas, notas personales, rating, referencias visuales, costos aproximados desde precios observados y un menu semanal simple.

No es una red social, no es una plataforma de delivery, no es un planificador nutricional completo, no sincroniza datos en la nube y no busca precios en tiempo real.

## Capacidades visibles para el usuario

### Gestionar recetas

El usuario puede crear, buscar, revisar, editar y eliminar recetas locales.

Cada receta puede tener:

- titulo;
- descripcion;
- categoria;
- favorita;
- nota personal;
- rating de 1 a 5;
- porciones;
- tiempos de preparacion y coccion;
- referencia de imagen o foto;
- ingredientes estructurados;
- pasos ordenados.

La vista principal de recetas funciona como un libro: muestra el listado, permite abrir una receta en una vista de detalle y desde esa vista se puede editar.

### Gestionar ingredientes y precios observados

El usuario puede mantener un catalogo local de ingredientes.

Cada ingrediente puede tener una unidad por defecto y un precio observado. El precio observado sirve para estimar costos de recetas cuando la unidad del ingrediente en la receta coincide con la unidad del precio registrado.

El costo es una estimacion local. No representa precios en tiempo real ni garantiza exactitud.

Las unidades son un catalogo cerrado definido por la app. Al editar recetas, el usuario puede elegir ingredientes existentes del catalogo o escribir uno nuevo. Si guarda una receta con un ingrediente nuevo, ese ingrediente debe quedar creado en el catalogo local.

### Administrar categorias

El usuario puede crear y editar categorias desde una vista propia. Las categorias se usan para clasificar recetas.

### Armar menu semanal

El usuario puede distribuir varias recetas por dia en una vista semanal simple.

### Organizar y revisar

El usuario puede filtrar por favoritas, buscar recetas y agruparlas por categoria.

El agente puede ayudar a ordenar recetas, detectar recetas sin precios suficientes, proponer categorias o transformar texto entregado por el usuario en una receta estructurada.

## Capacidades que no debes asumir

No afirmes que Recipes soporta estas capacidades salvo que el usuario pida implementarlas o encuentres evidencia real en el codigo:

- sincronizacion cloud;
- cuentas de usuario;
- scraping de recetas de internet;
- OCR o lectura automatica de imagenes;
- generacion garantizada de imagenes desde la app;
- lista de compras automatica;
- nutricion avanzada o calculo calorico;
- integraciones con supermercados.

Si el usuario comparte una receta en texto, imagen o PDF, el agente puede interpretarla si tiene la capacidad en la sesion y luego cargarla como datos estructurados. Esa interpretacion es trabajo del agente, no una capacidad automatica propia de la app.

## Herramientas internas del agente

### Stack database extension

Recipes usa el patron vigente del stack `vite-fastapi-sqlite`:

- `commons/backend/database.py` es el helper compartido de base de datos;
- Docker Compose monta ese helper sobre `backend/src/app/database.py`;
- Recipes registra modelos y setup propio en `backend/src/app/database_ext.py`;
- el backend llama `init_app_db()` al iniciar.

No quites el mount de `commons/backend/database.py` para resolver necesidades de modelos o migracion de Recipes. Las extensiones especificas de la app pertenecen a `database_ext.py`.

### Scripts y comandos

Los comandos de backend, frontend, Docker Compose y packaging son herramientas internas. No se los presentes al usuario final salvo que pida detalles tecnicos.

## Comunicacion hacia usuario final

Explica resultados en lenguaje funcional:

- que receta se creo o actualizo;
- que ingredientes quedaron asociados;
- que costos se pudieron estimar;
- que precios faltan para mejorar la estimacion;
- que datos necesitan revision.

Evita hablar de endpoints, rutas, SQLite, manifests o scripts salvo que el usuario lo pida.
