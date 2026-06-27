#include <Arduino.h>
#include <WiFi.h>
#include <FirebaseESP32.h>

#define WIFI_SSID " "
#define WIFI_PASSWORD " "

#define FIREBASE_HOST "huerto-propedeutico-default-rtdb.firebaseio.com" 
#define FIREBASE_AUTH "So9FOj9vgxovOnjHWhQKCgehhRq7rPTJKj01z2vN"

FirebaseData firebaseData;
FirebaseConfig config;
FirebaseAuth auth;

float sim_ph = 6.2;

float sim_ec = 1.4;
float sim_temp = 22.5;
int sim_estado_bomba = 0; 
bool sim_estado_peltier = false;

void setup() {
  Serial.begin(115200); 
  
  Serial.print("Conectando a Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[Wi-Fi] ¡Conectado con éxito!");

  config.host = FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  Serial.println("[Firebase] Conexión inicializada.");
  Serial.println("----------------------------------------");
}

void loop() {
  sim_ph += (random(-10, 11) / 100.0);   
  sim_ec += (random(-5, 6) / 100.0);     
  sim_temp += (random(-3, 4) / 10.0); 

  if (sim_ph < 5.0 || sim_ph > 7.5) sim_ph = 6.2;
  if (sim_ec < 0.8 || sim_ec > 2.2) sim_ec = 1.4;
  if (sim_temp < 17.0 || sim_temp > 26.5) sim_temp = 22.5;

  if (sim_temp > 24.0) {
    sim_estado_peltier = true;
  } else {
    sim_estado_peltier = false;
  }

  Firebase.setFloat(firebaseData, "/AT_H_V1/ph", sim_ph);
  Firebase.setFloat(firebaseData, "/AT_H_V1/ec", sim_ec);
  Firebase.setFloat(firebaseData, "/AT_H_V1/temp", sim_temp);
  Firebase.setBool(firebaseData, "/AT_H_V1/estado_peltier", sim_estado_peltier);
  
  Serial.printf("[TELEMETRÍA] pH: %.2f | EC: %.2f mS/cm | Temp: %.2f°C\n", sim_ph, sim_ec, sim_temp);
  Serial.printf("[ACTUADORES] Peltier: %s\n", sim_estado_peltier ? "ENFRIANDO (Activa)" : "EN REPOSO");

  if (Firebase.getInt(firebaseData, "/AT_H_V1/bomba_solicitud")) {
    int solicitud_app = firebaseData.intData();
    
    if (solicitud_app == 1 && sim_estado_bomba == 0) {
      sim_estado_bomba = 1;
      Serial.println("[BOMBA] Solicitud Web detectada -> ENCENDIENDO MOTOR");
      Firebase.setInt(firebaseData, "/AT_H_V1/bomba_estado", sim_estado_bomba);
      
    } else if (solicitud_app == 0 && sim_estado_bomba == 1) {
      sim_estado_bomba = 0;
      Serial.println("[BOMBA] Solicitud Web detectada -> APAGANDO MOTOR");
      Firebase.setInt(firebaseData, "/AT_H_V1/bomba_estado", sim_estado_bomba);
    }
  } else {
    Serial.println("[ERROR] No se pudo leer el nodo 'bomba_solicitud' en Firebase.");
  }

  Serial.println("----------------------------------------");
  delay(5000);
}