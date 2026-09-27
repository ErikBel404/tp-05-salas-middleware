# Trabajo práctico 05

## Descripción
Aplicación web desarrollada en Node.js y Express para la consulta de disponibilidad y reserva temporal de salas de estudio. El objetivo del proyecto radica en la implementación, diseño y justificación de un pipeline de middleware en Express, cubriendo funciones incorporadas, de terceros y personalizadas, organizadas según su alcance y dependencias de procesamiento.

## Instalación
Para preparar el entorno de ejecución, clonar el repositorio e instalar las dependencias declaradas en el archivo `package.json`:

```bash
   git clone <URL_DEL_REPOSITORIO>
   cd tp-05-salas-middleware
   npm install
```

## Ejecución
Antes de iniciar la aplicación, se puede comprobar la sintaxis del código sin ejecutarlo:

```bash
   npm run check
```
Para levantar el servidor en el entorno local:   
```Bash
   npm start
```
La consola confirmará el inicio y el servicio quedará escuchando en http://localhost:3000.

## Rutas
El sistema implementa el siguiente contrato de endpoints:   
1. GET /: Página inicial que describe el propósito de la plataforma y provee navegación hacia el listado de reservas y al formulario de alta.   
2. GET /estado: Devuelve un objeto JSON con el estado del servicio, el total de reservas en memoria y el identificador asignado a la solicitud.   
3. GET /reservas: Muestra todas las reservas existentes o un mensaje alternativo si no hay registros cargados.   
4. GET /reservas/nueva: Presenta el formulario accesible para ingresar una nueva solicitud. Declarado obligatoriamente antes de GET /reservas/:id para evitar colisiones de rutas.   
5. GET /reservas/:id: Muestra el detalle completo de la reserva buscada por su identificador numérico o responde con un error 404 en HTML si no existe.   
6. POST /reservas: Procesa el envío del formulario mediante una cadena de dos handlers (validarReserva y crearReserva). 


## Pipeline de middleware
El pipeline global procesa cada solicitud entrante en un orden secuencial estricto:   
1. morgan("dev") (Terceros): Registra en la terminal el método, la URL y el resultado preliminar de cada petición.   
2. identificarSolicitud (Personalizado global): Genera un código correlativo BIB-XXXX y lo almacena en res.locals.solicitudId para disponibilizarlo en todas las vistas y en la respuesta de /estado.   
3. medirDuracion (Personalizado global): Captura la marca de tiempo inicial con process.hrtime.bigint() y asocia un listener al evento finish del objeto res para calcular y registrar la duración total en milisegundos una vez enviada la respuesta.   
4. expressLayouts (Terceros): Intercepta el renderizado de vistas para insertar el contenido dentro de views/layouts/main.ejs.   
5. express.static (Incorporado): Resuelve y sirve los recursos estáticos desde la carpeta public.   
6. express.urlencoded({ extended: false }) (Incorporado): Analiza las solicitudes con cabecera application/x-www-form-urlencoded y puebla el objeto req.body.   
7. express.json() (Incorporado): Parsea cuerpos de solicitudes con formato JSON.   
8. Rutas directas (GET /, GET /estado): Handlers de nivel de aplicación.   
9. reservasRouter montado en /reservas: Router que define el área de trabajo y procesa las rutas relativas (/, /nueva, /:id, POST /).   
10. Handler 404 final: Middleware terminal que atrapa cualquier solicitud no resuelta por las capas anteriores, respondiendo con código 404 y renderizando no-encontrado.ejs sin invocar next().   

## Justificación del orden
* morgan, identificarSolicitud y medirDuracion se ubican al inicio para auditar de forma homogénea cualquier petición, incluyendo las que fallen o soliciten recursos estáticos.   
* expressLayouts debe preceder a las rutas para estar activo cuando se llame a res.render().   
* express.urlencoded y express.json se sitúan obligatoriamente antes de las rutas y del router de reservas; de lo contrario, req.body llegaría como undefined al middleware de validación.   
* El middleware de error 404 se registra al final de todo el archivo para capturar únicamente las peticiones que no hicieron coincidencia con ninguna ruta previa. 

## Diagrama del flujo POST válido

```
POST /reservas
  │
  ▼
morgan("dev")
  │ next()
  ▼
identificarSolicitud
  │ next()
  ▼
medirDuracion
  │ next()
  ▼
expressLayouts
  │ next()
  ▼
express.urlencoded
  │ next()
  ▼
reservasRouter
  │
  ▼
prepararAreaReservas
  │ next()
  ▼
validarReserva (Pasa validaciones -> crea req.reservaValidada)
  │ next()
  ▼
crearReserva (Agrega reserva al arreglo en memoria)
  │
  ▼
302 Redirección hacia /reservas
  │
  ▼
finish: ID + Método + URL + Código 302 + Duración en ms
```

## Diagrama del flujo POST inválido

```
POST /reservas
  │
  ▼
morgan("dev")
  │ next()
  ▼
identificarSolicitud
  │ next()
  ▼
medirDuracion
  │ next()
  ▼
expressLayouts
  │ next()
  ▼
express.urlencoded
  │ next()
  ▼
reservasRouter
  │
  ▼
prepararAreaReservas
  │ next()
  ▼
validarReserva (Falla comprobación -> status 400 + render de formulario)
  │
  └─► [FIN DEL CICLO: Termina en validarReserva sin llamar a next()]
  │
  ▼
finish: ID + Método + URL + Código 400 + Duración en ms
```

## Alcance de cada función

### Clasificación de middleware
* Middleware incorporado: Funciones provistas internamente por Express. Se emplean express.static para servir archivos públicos y los parsers express.urlencoded y express.json para interpretar las cargas útiles de red y construir req.body.
* Middleware de terceros: Librerías externas instaladas mediante el gestor de paquetes npm. Se utilizan morgan para la auditoría HTTP en consola y express-ejs-layouts para el ensamblado de plantillas maestras.   
* Middleware personalizado: Funciones desarrolladas a medida para la lógica del sistema. Comprenden identificarSolicitud (generación de ID), medirDuracion (cálculo de tiempos), prepararAreaReservas (fijación de variables locales de sección) y validarReserva (control de integridad de datos).  

### Funcionamiento de next()
En Express, la función next() le indica a la cadena de ejecución que el middleware actual finalizó su tarea de manera satisfactoria y que debe pasar el control al siguiente eslabón del pipeline. Si una función de middleware no invoca a next() y tampoco emite una respuesta al cliente (mediante res.render, res.json, res.redirect, etc.), la solicitud se suspende y el navegador permanece esperando de forma indefinida hasta agotar el tiempo de espera. Por otra parte, cuando un middleware emite una respuesta terminando el ciclo (como en el rechazo de validación con status 400), no debe llamar a next(), evitando errores de encabezados HTTP duplicados.

### Justificación de la posición de los parsers
Las peticiones HTTP transportan la información en el cuerpo a través de un flujo de bytes (streams). Los parsers express.urlencoded() y express.json() se encargan de leer ese flujo, convertirlo en una estructura accesible e insertarlo en el objeto req.body. Si estos parsers se ubicaran después de las rutas o del router, cualquier función que intente evaluar req.body (como validarReserva) fallará al encontrar dicho objeto indefinido.

### Alcances: global, de router y de ruta
* Alcance global (app.use): Aplica de forma transversal e incondicional a todas las peticiones recibidas por el servidor (por ejemplo: identificarSolicitud y medirDuracion).   
* Alcance de router (reservasRouter.use): Afecta únicamente a aquellas solicitudes que coincidan con la ruta de montaje asignada (/reservas). En este caso, prepararAreaReservas establece res.locals.seccion = "Reservas de salas" exclusivamente para las rutas de reservas, sin contaminar rutas externas como / o /estado.   
* Alcance de ruta (reservasRouter.post("/", validarReserva, crearReserva)): Limita su ejecución a la coincidencia estricta del método HTTP y la ruta definida. validarReserva únicamente se ejecuta cuando llega un envío POST directo sobre /reservas.   

### Justificación del evento finish
La medición precisa del ciclo de vida se realiza adjuntando un listener al evento finish de res porque Express delega la ejecución de forma asíncrona mediante next(). Calcular el tiempo transcurrido inmediatamente después de invocar next() arrojaría solo el tiempo que tardó en llamarse la siguiente función, omitiendo el renderizado, el acceso a datos y la transmisión física de la respuesta por la red. El evento finish lo dispara el núcleo de Node.js en el instante exacto en que los encabezados y el cuerpo han terminado de transmitirse al cliente

### Montaje del router y rutas relativas
Al montar el router con app.use("/reservas", reservasRouter), Express asocia el prefijo /reservas a todas las rutas declaradas en su interior. Por lo tanto, los métodos internos deben configurarse mediante rutas relativas (/, /nueva y /:id). Incluir la palabra /reservas dentro del router causaría duplicación estructural (generando URLs erróneas como /reservas/reservas/nueva).

### Patrón Post/Redirect/Get (PRG)
Tras completar con éxito la inserción de una reserva en crearReserva, el servidor responde enviando un código de estado 302 con la cabecera Location: /reservas. Esta redirección instruye al navegador a emitir una petición GET nueva e independiente hacia /reservas. Este patrón arquitectónico previene que, si el usuario recarga la página o utiliza los botones de navegación del historial, el navegador reenvíe accidentalmente la solicitud POST, evitando duplicaciones innecesarias de registros.

## Validación
El middleware validarReserva aplica controles en el servidor para asegurar la consistencia de los datos recibidos:   
1. Normalización de cadenas de texto mediante .trim().   
2. Verificación de presencia en todos los campos obligatorios (estudiante, email, sala, fecha, turno).   
3. Validación de correo electrónico conteniendo el carácter @.   
4. Pertenencia de la sala al conjunto estricto de opciones permitidas ("Sala Norte", "Sala Sur", "Sala Multimedia").   
5. Pertenencia del turno al catálogo válido ("Mañana", "Tarde", "Noche").   
6. Conversión del campo personas a número entero y verificación de rango restrictivo entre 1 y 6.   

Ante cualquier inconsistencia, el middleware responde con código 400, retiene los datos ingresados dentro del objeto valores para conservarlos en el formulario y renderiza la vista reservas/nueva mostrando un mensaje de error visible con el atributo accesible role="alert". Si la información es válida, construye req.reservaValidada y llama a next() para dar paso al guardado en crearReserva

## Pruebas manuales

A continuación se detalla la matriz de verificación realizada sobre los casos solicitados para comprobar el correcto funcionamiento del pipeline, códigos de estado HTTP y respuestas visuales o en consola:

| Caso | Método / URL / Acción | Estado esperado | Evidencia observable / Salida esperada |
| :--- | :--- | :---: | :--- |
| **Inicio** | `GET /` | `200` | Carga de portada con enlaces a listado y formulario, con el identificador `solicitudId` visible en el pie de página. |
| **Estado** | `GET /estado` | `200` | Respuesta JSON con formato: `{"servicio":"activo","reservas":4,"solicitudId":"BIB-XXXX"}`. |
| **Listado** | `GET /reservas` | `200` | Muestra las 4 tarjetas de reservas iniciales con sus datos correspondientes. |
| **Estado vacío** | `GET /reservas` (con arreglo vacío) | `200` | Mensaje alternativo amigable avisando que no hay reservas registradas en el momento. |
| **Formulario** | `GET /reservas/nueva` | `200` | Renderizado de formulario con campos asociados mediante etiquetas `<label>` y opciones de select. |
| **Detalle válido** | `GET /reservas/1` | `200` | Vista de detalle completa con estudiante, email, sala, fecha, turno y cantidad de personas. |
| **Detalle inexistente** | `GET /reservas/999` | `404` | Página HTML (`no-encontrado.ejs`) indicando que la reserva con ese identificador no existe. |
| **Campos vacíos** | `POST /reservas` (campos en blanco) | `400` | Rechazo con código 400, renderiza el formulario con alerta `role="alert"` y preserva valores cargados. |
| **Sala no permitida** | `POST /reservas` (`sala: "Sala Inexistente"`) | `400` | Rechazo con código 400 por no pertenecer a las permitidas; no se agrega registro a la memoria. |
| **Turno no permitido** | `POST /reservas` (`turno: "Madrugada"`) | `400` | Rechazo con código 400 por turno no admitido; no se agrega registro a la memoria. |
| **Email sin @** | `POST /reservas` (`email: "usuario.dominio.com"`) | `400` | Rechazo con código 400 por no superar la validación básica de formato con `@`. |
| **Personas igual a 0** | `POST /reservas` (`personas: 0`) | `400` | Rechazo con código 400 por estar fuera del rango permitido (1 a 6). |
| **Personas igual a 7** | `POST /reservas` (`personas: 7`) | `400` | Rechazo con código 400 por exceder la capacidad máxima de 6 personas. |
| **Reserva válida** | `POST /reservas` (datos correctos) | `302` y luego `200` | Redirección 302 hacia `/reservas`, nuevo GET 200 y aparición de la tarjeta creada en la lista. |
| **URL inexistente** | `GET /ruta-desconocida` | `404` | Atrapada por el middleware final del pipeline renderizando la pantalla de error 404. |
| **Reinicio** | Reiniciar servidor (`Ctrl + C` y `npm start`) | `200` | Al consultar `/reservas` se constata el retorno a las 4 reservas iniciales al limpiarse la RAM. |

> **Nota de verificación en consola:** Durante cada una de estas pruebas, se verifico en la terminal que tanto la salida de `morgan("dev")` como  la línea personalizada de `medirDuracion` (`[BIB-XXXX] METODO RUTA STATUS TIEMPO ms`) se imprimieron en tiempo real con los códigos de respuesta correctos (200, 302, 400 y 404).

## Persistencia temporal
El almacenamiento de las reservas se gestiona enteramente en un arreglo residente en la memoria RAM del proceso de Node.js. Por diseño del trabajo práctico, no se interactúa con bases de datos ni con archivos en el disco para guardar las altas. En consecuencia, cualquier nueva reserva creada durante la ejecución existe únicamente mientras el proceso continúe activo; al detener o reiniciar el servidor, la memoria es liberada por el sistema operativo y el sistema vuelve a iniciar con las cuatro reservas predeterminadas de src/index.js