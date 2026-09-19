#include <Arduino.h>
#include <WiFi.h>
#include <FirebaseESP32.h>

#define WIFI_SSID "TU_SSID_WIFI"
#define WIFI_PASSWORD "TU_PASSWORD_WIFI"

#define FIREBASE_HOST "huerto-propedeutico-default-rtdb.firebaseio.com" 
#define FIREBASE_AUTH "So9FOj9vgxovOnjHWhQKCgehhRq7rPTJKj01z2vN"

FirebaseData firebaseData;
FirebaseConfig config;
FirebaseAuth auth;

float sim_ph = 6.2;
float sim_ec = 1.4;
float sim_temp = 22.5;
float sim_hum = 65.0;

void setup() {
  Serial.begin(115200); 
  delay(1000);

  Serial.printf("\n[Wi-Fi] Conectando a %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[Wi-Fi] ¡Conectado con éxito!");
  Serial.printf("[IP] Dirección IP local: %s\n", WiFi.localIP().toString().c_str());

  
  config.host = FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  Serial.println("[Firebase] Conexión inicializada correctamente.");
  Serial.println("----------------------------------------");
}

void loop() {
  
  sim_ph += (random(-10, 11) / 100.0);    
  sim_ec += (random(-5, 6) / 100.0);      
  sim_temp += (random(-3, 4) / 10.0);  
  sim_hum += (random(-20, 21) / 10.0);

  
  if (sim_ph < 5.0 || sim_ph > 7.5) sim_ph = 6.2;
  if (sim_ec < 0.8 || sim_ec > 2.5) sim_ec = 1.4;
  if (sim_temp < 17.0 || sim_temp > 30.0) sim_temp = 22.5;
  if (sim_hum < 40.0 || sim_hum > 90.0) sim_hum = 65.0;

  
  Firebase.setFloat(firebaseData, "/sensores/ph", sim_ph);
  Firebase.setFloat(firebaseData, "/sensores/ec", sim_ec);
  Firebase.setFloat(firebaseData, "/sensores/temperatura", sim_temp);
  Firebase.setFloat(firebaseData, "/sensores/humedad", sim_hum);
  
  Serial.printf("[TELEMETRÍA] pH: %.2f | EC: %.2f mS/cm | Temp: %.2f°C | Hum: %.2f%%\n", sim_ph, sim_ec, sim_temp, sim_hum);

  if (Firebase.getBool(firebaseData, "/actuadores/bomba_muestreo")) {
    bool estadoBomba2 = firebaseData.boolData();
    if (estadoBomba2) {
      Serial.println("[ACTUADOR] Bomba Secundaria: ENCENDIDA desde la Web");
      
    } else {
      Serial.println("[ACTUADOR] Bomba Secundaria: APAGADA desde la Web");
      
    }
  }

  
  if (Firebase.getBool(firebaseData, "/actuadores/peltier")) {
    bool estadoPeltier = firebaseData.boolData();
    if (estadoPeltier) {
      Serial.println("[ACTUADOR] Placa Peltier: ENCENDIDA (Enfriando)");
    
    } else {
      Serial.println("[ACTUADOR] Placa Peltier: APAGADA (En reposo)");
      
    }
  }

  Serial.println("----------------------------------------");
  delay(4000);
}