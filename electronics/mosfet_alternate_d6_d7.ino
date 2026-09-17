// Arduino Uno: alternate two LED loads through IRLZ44N MOSFETs.
// D6 -> 220 ohm -> MOSFET 1 gate; D7 -> 220 ohm -> MOSFET 2 gate.
// Each gate -> its own 10k ohm -> GND. Both sources -> GND.
// Each load: 5V -> its own 220 ohm -> LED anode; LED cathode -> drain.
// Standalone test only: no Bluetooth, sensors, or main-circuit control.

const byte MOSFET_1 = 6;
const byte MOSFET_2 = 7;
const unsigned long HOLD_MS = 1000;

void setup() {
  // Set output latches LOW before enabling outputs.
  digitalWrite(MOSFET_1, LOW);
  digitalWrite(MOSFET_2, LOW);
  pinMode(MOSFET_1, OUTPUT);
  pinMode(MOSFET_2, OUTPUT);
}

void loop() {
  // LED 1 ON, LED 2 OFF. Turn the old channel off first.
  digitalWrite(MOSFET_2, LOW);
  digitalWrite(MOSFET_1, HIGH);
  delay(HOLD_MS);

  // LED 1 OFF, LED 2 ON.
  digitalWrite(MOSFET_1, LOW);
  digitalWrite(MOSFET_2, HIGH);
  delay(HOLD_MS);
}
