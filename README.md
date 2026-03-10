# Análisis Exploratorio de Datos: Suicidios en Colombia (2021)

## Descripción del Proyecto

Este proyecto presenta un análisis exploratorio de datos (EDA) sobre los incidentes de intentos de suicidio registrados en Colombia durante el año 2021. El análisis incluye visualizaciones temporales, geográficas y métricas ajustadas por población para comprender mejor este fenómeno de salud pública.

## Autores

- Samuel Gómez
- Jacobo Petelli

## Estructura del Repositorio

```
.
├── data/
│   ├── datos_suicidios_2021.csv      # Datos de suicidios por semana, municipio y departamento
│   ├── poblacion_colombia_2020.csv    # Datos poblacionales por departamento y grupo etario
│   └── PIB_departamental.csv          # PIB por departamento (no utilizado en análisis actual)
├── eda_suicidios.qmd                  # Documento Quarto con análisis completo
├── eda_suicidios.pdf                  # Reporte en formato IEEE Conference
└── README.md                          # Este archivo
```

## Fuentes de Datos

### Datos de Suicidios
Los datos de intentos de suicidio provienen del portal de datos abiertos del gobierno colombiano:

[Datos.gov.co - Intento de Suicidio 2021](https://www.datos.gov.co/resource/fhc4-jjti.csv?$query=SELECT%0A%20%20%60cod_eve%60%2C%0A%20%20%60nombre_evento%60%2C%0A%20%20%60semana%60%2C%0A%20%20%60ano%60%2C%0A%20%20%60municipio_ocurrencia%60%2C%0A%20%20%60departamento_ocurrencia%60%2C%0A%20%20%60conteo%60%0AWHERE%20caseless_eq(%60nombre_evento%60%2C%20%22INTENTO%20DE%20SUICIDIO%22))

### Datos de PIB Departamental
Son presentados por el Departamento Administrativo Nacional de Estadística (DANE).

**Variables incluidas:**
- Semana epidemiológica
- Departamento y municipio de ocurrencia
- Conteo de casos

[PIB Departamental](https://www.dane.gov.co/files/operaciones/PIB/anex-PIBDep-TotalDep-2024pr.xlsx)

**Variables incluidas:**
- Aporte al PIB nacional en miles de millones de pesos para diferentes años por cada departamento

### Datos Poblacionales
Censo de población de Colombia por departamento, grupo etario y sexo (2020).

[Proyecciones de Población Departamental 2018-2050](https://www.dane.gov.co/files/censo2018/proyecciones-de-poblacion/Departamental/PPED-AreaDep-2018-2050_VP.xlsx)

### Cartografía
Shapefile departamental oficial de Colombia (MGN2024) utilizado para visualizaciones geoespaciales.

## Contenido del Análisis

El documento `eda_suicidios.qmd` incluye:

1. **Calidad y cobertura de los datos**
   - Indicadores de completitud
   - Identificación de semanas con picos de casos

2. **Exploración temporal**
   - Gráfico de áreas apiladas por departamento (stream chart)
   - Tendencia semanal nacional con puntos clave

3. **Exploración geográfica**
   - Gráfico de dispersión: volumen vs variabilidad semanal
   - Mapa coroplético departamental con tasa per cápita

4. **Análisis per cápita**
   - Tasa de casos por 100,000 habitantes
   - Ranking departamental ajustado por tamaño poblacional
   - Visualización de departamentos con mayor carga relativa

## Requisitos Técnicos

### Librerías de R

```r
library(tidyverse)  # Manipulación de datos y visualización
library(scales)     # Formateo de escalas en gráficos
library(lubridate)  # Manejo de fechas
library(sf)         # Procesamiento de datos geoespaciales
```

### Software

- R (versión ≥ 4.0)
- Quarto CLI
- LaTeX (para renderizado PDF en formato IEEE)

## Uso

Para regenerar el análisis:

```bash
quarto render eda_suicidios.qmd
```

El documento se renderizará en formato PDF siguiendo el estilo IEEE Conference (documentclass: IEEEtran).

## Resultados Principales

- **Cobertura**: 10,895 filas de datos, 29,792 casos totales, 52 semanas, 34 departamentos, 945 municipios
- **Semanas pico**: Semanas 39, 37 y 44 (cada una con ~2.3% del total anual)
- **Departamentos con mayor tasa per cápita**: Vaupés, Caldas, Quindío, Risaralda, Putumayo
- **Variabilidad**: Existe relación positiva entre volumen total y variabilidad semanal por departamento

## Nota

Este análisis es de carácter exploratorio y técnico. Requiere interpretación por parte de especialistas en salud pública para la formulación de políticas y estrategias de intervención.