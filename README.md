# 🌱 Sistema Automatizado de Monitoreo Hidropónico (IoT)

![Estado](https://img.shields.io/badge/Estado-Activo-4ade80?style=for-the-badge)
![Hardware](https://img.shields.io/badge/Hardware-ESP32-31ded9?style=for-the-badge)
![Lenguaje C++](https://img.shields.io/badge/C++-Firmware-00599C?style=for-the-badge)
![Frontend](https://img.shields.io/badge/Frontend-JS%20|%20HTML%20|%20CSS-f7df1e?style=for-the-badge)
![Base de Datos](https://img.shields.io/badge/Database-Firebase_RTDB-FFCA28?style=for-the-badge)

**Institución:** Escuela Superior de Huejutla  
**Programa:** Propedéutico Ciencias Básicas e Ingeniería  
**Desarrollador:** Alan Hussein Ramírez Téllez  

---

## Resumen Ejecutivo

El presente proyecto detalla el diseño e implementación de un sistema de telemetría IoT avanzado para el monitoreo y control en tiempo real de los parámetros críticos en un cultivo hidropónico. 

El sistema utiliza una arquitectura basada en un microcontrolador **ESP32** programado en C++ que transmite datos a una base de datos en la nube (**Firebase Realtime Database**), permitiendo la visualización y el control remoto a través de un panel web responsivo (*Dashboard*) de alto rendimiento.

## Innovaciones y Características Principales

Este sistema fue diseñado para resolver problemáticas reales de la instrumentación agrícola de bajo costo mediante soluciones mecatrónicas y de software:

* **Sistema de Muestreo Intermitente (Bypass):** Utiliza una mini bomba para extraer agua hacia una cámara de muestreo durante solo unos minutos al día. Esto multiplica exponencialmente la vida útil de las sondas de pH y Conductividad Eléctrica (CE), evitando la degradación química continua.
* **Aislamiento Galvánico por Software:** La alimentación eléctrica (VCC) de cada sensor analógico es controlada mediante pines digitales secuenciales del ESP32. Esto evita bucles de tierra y la interferencia cruzada entre los sensores de pH y CE al medir en la misma solución.
* **Acondicionamiento Térmico Activo (Peltier):** Integración de un sistema de refrigeración de estado sólido (Celda Peltier TEC1-12706 + Fuente 12V 10A) controlado mediante una banda de histéresis programada en el microcontrolador. Mantiene el agua entre los 18°C y 24°C para evitar la hipoxia radicular.
* **Compensación Automática de Temperatura (ATC):** Algoritmo que ajusta matemáticamente las lecturas de Conductividad Eléctrica en función de la temperatura del agua leída por el sensor digital sumergible DS18B20.
* **Dashboard Web:** Interfaz de usuario diseñada bajo el paradigma de *Glassmorphism*, integración con **Chart.js** para visualización de históricos y comunicación bidireccional en tiempo real.

---

## Arquitectura de Hardware

### Lista de Componentes Principales

| Componente | Especificación Técnica |
| :--- | :--- |
| **Microcontrolador** | ESP32 (Módulo NodeMCU WiFi/Bluetooth) |
| **Sensor de pH** | Sonda analógica BNC tipo E-201-C |
| **Sensor CE (TDS)** | Sensor analógico genérico de Conductividad |
| **Sensor Térmico** | DS18B20 Digital (Encapsulado de acero sumergible) |
| **Refrigeración** | Celda Termoeléctrica Peltier TEC1-12706 (12V) + Waterblock |
| **Potencia y Control** | Módulo MOSFET IRLZ44N y Relés de 5V |
| **Fuente de Poder** | Fuente Conmutada Industrial Metálica (12V 10A) |
| **Bombeo** | Mini bomba de agua sumergible (5V DC) |

---

## Estructura del Proyecto

El repositorio contiene tanto el código del firmware embebido como el sistema frontend web:

```text
📁 huerto-esh/
├── 📄 index.html        # Estructura principal del Dashboard Web.
├── 📄 style.css         # Estilos.
├── 📄 script.js         # Lógica de Firebase, gráficos Chart.js y simulación.
└── 📁 firmware/        
    └── 📄 main.cpp      # Código fuente del microcontrolador ESP32 (C++).
