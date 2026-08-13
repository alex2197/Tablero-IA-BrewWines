# Nueva pestaña: Pulso

Pantalla de entrada para dirección. **No se tocó ninguna de las pestañas
existentes** — todos sus cálculos y gráficas quedan igual.

## Qué hace

Responde en dos minutos las tres preguntas con las que se levanta un director:
¿vamos bien o mal?, ¿qué se está rompiendo?, ¿dónde está atorado el dinero?

### Cuatro números, no doce

Venta del mes, margen bruto, días de cartera y meses de inventario. Cada uno con
su comparación y una barra de estado en verde, ámbar o rojo.

Un número solo no informa. "12% arriba del mes anterior" ya es una decisión.

### Hallazgos ordenados por impacto en pesos

Es la diferencia entre un tablero que se usa y uno que se abandona: **quién
empieza la conversación**. Aquí el tablero habla primero.

Se calculan seis tipos de hallazgo y solo aparecen si existen:

| Hallazgo | Qué detecta |
|---|---|
| Venta en fuga | Clientes que cayeron más de 30% comparando el primer tercio del periodo contra el último |
| Inventario excedente | Productos con más de 12 meses de cobertura |
| Concentración | Cuántos clientes generan el 80% de la venta |
| Factura anómala | Ventas grandes con margen fuera de rango |
| Cumplimiento de pago | Porcentaje que paga dentro del plazo pactado |
| Dispersión de precio | Mismo producto vendido con más de 40% de variación |

Cada uno lleva la lista de casos concretos, con nombre, cifra y vendedor
asignado. **De la alerta a la acción en un clic.**

Si no hay desviaciones, lo dice. Eso también es información.

### Trayectoria

Una sola gráfica: venta mensual con la proyección punteada hacia adelante. El mes
en curso se excluye del ajuste para no sesgar la recta, y se avisa cuántos días
lleva.

## Ocho métricas nuevas, cero datos nuevos

Índice de concentración, clientes en caída, meses de cobertura por producto,
cobertura global de inventario, días de cartera, cumplimiento de plazo,
dispersión de precio y detección de facturas anómalas.

Todas salen de los archivos que ya se cargan.

## Cómo se conectó

- **El chat** tiene `consultar_pulso`. Preguntas abiertas como *"¿cómo va el
  negocio?"* o *"¿qué debo revisar?"* ahora traen el panorama completo en lugar
  de una cifra suelta
- **El PDF** abre con una sección de Hallazgos prioritarios, después del resumen
  ejecutivo
- **El resumen escrito** da prioridad a esos hallazgos al redactar

## Qué cambió del orden

Pulso es la **primera pestaña** y la que abre por defecto. Las demás quedan en el
mismo orden.

Si prefieres que abra en Ventas General, es una línea en `src/store/estado.ts`:
mover `['pulso', 'Pulso']` al final del arreglo `VISTAS` y cambiar el valor
inicial de `vista`.

## Pasos

```cmd
npm install
npm run build
git add .
git commit -m "Pestana Pulso para direccion"
git push
```

Sin migración. Ningún dato nuevo, ningún cambio de esquema.

### Para probar

1. Abre el tablero: debe entrar directo a Pulso
2. Revisa que los cuatro indicadores tengan números coherentes
3. Abre el detalle de un hallazgo y usa el enlace de la derecha
4. Pregúntale al chat *"¿cómo va el negocio?"*
5. Genera el PDF y verifica la sección de Hallazgos

## Qué esperar con los datos de Brew Wines

Validé la lógica contra los Excel. Deberías ver algo así:

- **8 clientes en caída** con $1.2M de venta en riesgo
- **$17.2M en inventario** con más de un año de cobertura, el 74% del total
- **16 de 280 clientes** generan el 80% de la venta; el primero concentra 44.7%
- **42% de cumplimiento de pago**: plazo de 60 días, mediana real de 56, promedio
  de 152
- **10.7 meses** de cobertura global de inventario
- **127 días** de cartera

Ninguno de esos números aparece hoy en ninguna parte del tablero ni del reporte
anterior.
