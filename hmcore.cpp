#include <WProgram.h>
#include <avr/eeprom.h>

#include "hmcore.h"
#include "strings.h"

#ifdef HEATERMETER_NETWORKING
#include <WiServer.h>  
#include <dataflash.h>
#endif

static TempProbe probe0(PIN_PIT,   &STEINHART[0]);
static TempProbe probe1(PIN_FOOD1, &STEINHART[0]);
static TempProbe probe2(PIN_FOOD2, &STEINHART[0]);
static TempProbe probe3(PIN_AMB,   &STEINHART[1]);
GrillPid pid(PIN_BLOWER);

ShiftRegLCD lcd(PIN_LCD_DATA, PIN_LCD_CLK, TWO_WIRE, 2); 

#ifdef HEATERMETER_NETWORKING
static boolean g_NetworkInitialized;
#endif /* HEATERMETER_NETWORKING */

#define MIN(x,y) ( x > y ? y : x )
#define eeprom_read_to(dst_p, eeprom_field, dst_size) eeprom_read_block(dst_p, (void *)offsetof(__eeprom_data, eeprom_field), MIN(dst_size, sizeof((__eeprom_data*)0)->eeprom_field))
#define eeprom_read(dst, eeprom_field) eeprom_read_to(&dst, eeprom_field, sizeof(dst))
#define eeprom_write_from(src_p, eeprom_field, src_size) eeprom_write_block(src_p, (void *)offsetof(__eeprom_data, eeprom_field), MIN(src_size, sizeof((__eeprom_data*)0)->eeprom_field))
#define eeprom_write(src, eeprom_field) { typeof(src) x = src; eeprom_write_from(&x, eeprom_field, sizeof(x)); }

#define EEPROM_MAGIC 0xf00d800

const struct PROGMEM __eeprom_data {
  long magic;
  int setPoint;
  char probeNames[TEMP_COUNT][PROBE_NAME_SIZE];
  char probeTempOffsets[TEMP_COUNT];
  unsigned char lidOpenOffset;
  unsigned int lidOpenDuration;
  float pidConstants[4]; // constants are stored Kb, Kp, Ki, Kd
  boolean manualMode;
  unsigned char maxFanSpeed;  // in percent
} DEFAULT_CONFIG PROGMEM = { 
  EEPROM_MAGIC,  // magic
  225,  // setpoint
  { "Pit", "Food Probe1", "Food Probe2", "Ambient" },  // probe names
  { 0, 0, 0 },  // probe offsets
  15,  // lid open offset
  240, // lid open duration
  { 5.0f, 4.0f, 0.002f, 4.0f },
  false, // manual mode
  100  // max fan speed
};

boolean storeProbeName(unsigned char probeIndex, const char *name)
{
  if (probeIndex >= TEMP_COUNT)
    return false;
    
  void *ofs = &((__eeprom_data*)0)->probeNames[probeIndex];
  eeprom_write_block(name, ofs, PROBE_NAME_SIZE);
  return true;
}

void loadProbeName(unsigned char probeIndex)
{
  void *ofs = &((__eeprom_data*)0)->probeNames[probeIndex];
  eeprom_read_block(editString, ofs, PROBE_NAME_SIZE);
}

void storeSetPoint(int sp)
{
  // If the setpoint is >0 that's an actual setpoint.  
  // 0 or less is a manual fan speed
  if (sp > 0)
  {
    eeprom_write(sp, setPoint);
    eeprom_write(false, manualMode);
    pid.setSetPoint(sp);
  }
  else
  {
    eeprom_write(true, manualMode);
    pid.setFanSpeed(-sp);
  }
}

boolean storeProbeOffset(unsigned char probeIndex, char offset)
{
  if (probeIndex >= TEMP_COUNT)
    return false;
    
  uint8_t *ofs = (uint8_t *)&((__eeprom_data*)0)->probeTempOffsets[probeIndex];
  pid.Probes[probeIndex]->Offset = offset;
  eeprom_write_byte(ofs, offset);
  
  return true;
}

void storeMaxFanSpeed(unsigned char maxFanSpeed)
{
  pid.MaxFanSpeed = maxFanSpeed;
  eeprom_write(maxFanSpeed, maxFanSpeed);
}

void updateDisplay(void)
{
  // Updates to the temperature can come at any time, only update 
  // if we're in a state that displays them
  if (Menus.State < ST_HOME_FOOD1 || Menus.State > ST_HOME_AMB)
    return;
  char buffer[17];

  // Fixed pit area
  lcd.home();
  int pitTemp = pid.Probes[TEMP_PIT]->Temperature;
  if (!pid.getManualFanMode() && pitTemp == 0)
    memcpy_P(buffer, LCD_LINE1_UNPLUGGED, sizeof(LCD_LINE1_UNPLUGGED));
  else if (pid.LidOpenResumeCountdown > 0)
    snprintf_P(buffer, sizeof(buffer), LCD_LINE1_DELAYING, pitTemp, pid.LidOpenResumeCountdown);
  else
  {
    char c1,c2;
    if (pid.getManualFanMode())
    {
      c1 = '^';  // LCD_ARROWUP
      c2 = '^';  // LCD_ARROWDN
    }
    else
    {
      c1 = '[';
      c2 = ']';
    }
    snprintf_P(buffer, sizeof(buffer), LCD_LINE1, pitTemp, c1, pid.getFanSpeed(), c2);
  }
  lcd.print(buffer); 

  // Rotating probe display
  unsigned char probeIndex = Menus.State - ST_HOME_FOOD1 + 1;
  if (probeIndex < TEMP_COUNT)
  {
    loadProbeName(probeIndex);
    snprintf_P(buffer, sizeof(buffer), LCD_LINE2, editString, (int)pid.Probes[probeIndex]->Temperature);
  }
  else
  {
    // If probeIndex is outside the range (in the case of ST_HOME_NOPROBES)
    // just fill the bottom line with spaces
    memset(buffer, ' ', sizeof(buffer));
    buffer[sizeof(buffer-1)] = 0;
  }

  lcd.setCursor(0, 1);
  lcd.print(buffer);
}

void lcdprint_P(const prog_char *p, const boolean doClear)
{
  char buffer[17];
  strncpy_P(buffer, p, sizeof(buffer));

  if (doClear)
    lcd.clear();
  lcd.print(buffer);
}

boolean storePidParam(char which, float value)
{
  const prog_char *pos = strchr_P(PID_ORDER, which);
  if (pos == NULL)
    return false;
    
  const unsigned char k = pos - PID_ORDER;
  pid.Pid[k] = value;
  
  uint8_t *ofs = (uint8_t *)&((__eeprom_data*)0)->pidConstants[k];
  eeprom_write_block(&pid.Pid[k], ofs, sizeof(value));

  return true;
}

void storeLidOpenOffset(unsigned char value)
{
  pid.LidOpenOffset = value;    
  eeprom_write(pid.LidOpenOffset, lidOpenOffset);
}

void storeLidOpenDuration(unsigned int value)
{
  pid.LidOpenDuration = value;    
  eeprom_write(pid.LidOpenDuration, lidOpenDuration);
}

#ifdef HEATERMETER_NETWORKING

struct temp_log_record {
  unsigned int temps[TEMP_COUNT]; 
  unsigned char fan;
  unsigned char fan_avg;
};

#define RING_POINTER_INC(x) x = (x + 1) % ((DATAFLASH_PAGE_BYTES / sizeof(struct temp_log_record)) - 1)

void flashRingBufferInit(void)
{
  /* A simple ring buffer in the dflash buffer page, the first "record" is reserved 
     to store the head and tail indexes ((index+1) * size = addr)
     as well as a "write lock".  Because the web server may take several seconds
     to serve the entire log, we stop logging during that time to keep the data
     consistent across the entire page dispatch 
     */
  unsigned char dummy[sizeof(struct temp_log_record)];
  memset(dummy, 0, sizeof(dummy));
  
  // The first record is actually (uint8_t head, uint8_t tail, uint32_t writestart) but 
  // this is just to initialize it all to 0
  dflash.Buffer_Write_Str(1, 0, sizeof(dummy), dummy);
  dflash.DF_CS_inactive();
}

void flashRingBufferWrite(struct temp_log_record *p)
{
  unsigned char head = dflash.Buffer_Read_Byte(1, 0);
  unsigned char tail = dflash.Buffer_Read_Byte(1, 1);

  unsigned int addr = (tail + 1) * sizeof(*p);
  dflash.Buffer_Write_Str(1, addr, sizeof(*p), (unsigned char *)p);
  RING_POINTER_INC(tail);
  dflash.Buffer_Write_Byte(1, 1, tail);
  
  if (tail == head)
  {
    RING_POINTER_INC(head);
    dflash.Buffer_Write_Byte(1, 0, head);
  }
  
  dflash.DF_CS_inactive();
}

void storeTemps(void)
{
  struct temp_log_record temp_log;
  unsigned char i;
  for (i=0; i<TEMP_COUNT; i++)
  {
    // Store the difference between the temp and the average in the high 7 bits
    // This allows the temperature to be between 0-511 and the average to be 
    // within 63 degrees of that
    char avgOffset = (char)(pid.Probes[i]->Temperature - pid.Probes[i]->TemperatureAvg);
    temp_log.temps[i] = (avgOffset << 9) | (int)pid.Probes[i]->Temperature;
  }
  temp_log.fan = pid.getFanSpeed();
  temp_log.fan_avg = (unsigned char)pid.FanSpeedAvg;
  
  flashRingBufferWrite(&temp_log);
}

#define HTTP_HEADER_LENGTH 19 // "HTTP/1.0 200 OK\r\n\r\n"
void sendFlashFile(const struct flash_file_t *file)
{
  // Note we mess with the underlying UIP stack to prevent reading the entire
  // file each time from flash just to discard all but 300 bytes of it
  // Speeds up an 11kB send by approximately 3x (up to 1.5KB/sec)
  uip_tcp_appstate_t *app = &(uip_conn->appstate);
  unsigned int sentBytes = app->ackedCount;

  // The first time through, the buffer contains the header but nothing is acked yet
  // so don't mess with any of the state, just send the first segment  
  if (app->ackedCount > 0)
  {
   app->cursor = (char *)sentBytes;
   sentBytes -= HTTP_HEADER_LENGTH;
  }

  unsigned int page = pgm_read_word(&file->page) + (sentBytes / DATAFLASH_PAGE_BYTES);
  unsigned int off = sentBytes % DATAFLASH_PAGE_BYTES;
  unsigned int size = pgm_read_word(&file->size);
  unsigned int sendSize = size - sentBytes;

  if (sendSize > UIP_TCP_MSS)
    sendSize = UIP_TCP_MSS;
   
  dflash.Cont_Flash_Read_Enable(page, off);
  while (sendSize-- > 0)
    WiServer.write(dflash.Cont_Flash_Read());
  dflash.DF_CS_inactive();
  
  // Pretend that we've sent the whole file
  app->cursor = (char *)(HTTP_HEADER_LENGTH + size);
}

void outputLog(void)
{
  unsigned char head = dflash.Buffer_Read_Byte(1, 0);
  unsigned char tail = dflash.Buffer_Read_Byte(1, 1);
  
  while (head != tail)
  {
    struct temp_log_record p;
    unsigned int addr = (head + 1) * sizeof(p);
    dflash.Buffer_Read_Str(1, addr, sizeof(p), (unsigned char *)&p);
    RING_POINTER_INC(head);
    
    char offset;
    int temp;
    unsigned char i;
    for (i=0; i<TEMP_COUNT; i++)
    {
      temp = p.temps[i] & 0x1ff;
      WiServer.print(temp,DEC);  // temperature
      WiServer.print_P(COMMA);
      offset = p.temps[i] >> 9;
      WiServer.print(temp + offset,DEC);  // average
      WiServer.print_P(COMMA);
    }
    
    WiServer.print(p.fan,DEC);
    WiServer.print_P(COMMA);
    WiServer.println(p.fan_avg,DEC);
  }  
  dflash.DF_CS_inactive();
}

void outputCsv(void)
{
  WiServer.print(pid.getSetPoint());
  WiServer.print_P(COMMA);

  unsigned char i;
  for (i=0; i<TEMP_COUNT; i++)
  {
    WiServer.print((double)pid.Probes[i]->Temperature, 1);
    WiServer.print_P(COMMA);
  }

  WiServer.print(pid.getFanSpeed(),DEC);
  WiServer.print_P(COMMA);
  WiServer.print(round(pid.FanSpeedAvg),DEC);
  WiServer.print_P(COMMA);
  WiServer.print(pid.LidOpenResumeCountdown, DEC);
}

void outputJson(void)
{
  WiServer.print_P(JSON1);

  unsigned char i;
  for (i=0; i<TEMP_COUNT; i++)
  {
    WiServer.print_P(JSON_T1);
    loadProbeName(i);
    WiServer.print(editString);
    WiServer.print_P(JSON_T2);
    WiServer.print(pid.Probes[i]->Temperature, 1);
    WiServer.print_P(JSON_T3);
    WiServer.print(pid.Probes[i]->TemperatureAvg, 2);
    WiServer.print_P(JSON_T4);
  }
  
  WiServer.print_P(JSON2);
  WiServer.print(pid.getSetPoint(),DEC);
  WiServer.print_P(JSON3);
  WiServer.print(pid.LidOpenResumeCountdown,DEC);
  WiServer.print_P(JSON4);
  WiServer.print(pid.getFanSpeed(),DEC);
  WiServer.print_P(JSON5);
  WiServer.print((unsigned char)pid.FanSpeedAvg,DEC);
  WiServer.print_P(JSON6);
}

boolean sendPage(char* URL)
{
  ++URL;  // WARNING: URL no longer has leading '/'
  unsigned char urlLen = strlen(URL);
  
  if (strcmp_P(URL, URL_JSON) == 0) 
  {
    outputJson();
    return true;    
  }
  if (strcmp_P(URL, URL_CSV) == 0) 
  {
    outputCsv();
    return true;    
  }
  if (strcmp_P(URL, URL_LOG) == 0) 
  {
    outputLog();
    return true;    
  }
  if (strncmp_P(URL, URL_SETPOINT, 7) == 0) 
  {
    storeSetPoint(atoi(URL + 7));
    WiServer.print_P(WEB_OK);
    return true;
  }
  if (strncmp_P(URL, URL_SETPID, 7) == 0 && urlLen > 9) 
  {
    float f = atof(URL + 9);
    if (storePidParam(URL[7], f))
      WiServer.print_P(WEB_OK);
    else
      WiServer.print_P(WEB_FAILED);
    return true;
  }
  if (strncmp_P(URL, URL_SETPNAME, 6) == 0 && urlLen > 8) 
  {
    if (storeProbeName(URL[6] - '0', URL + 8))
      WiServer.print_P(WEB_OK);
    else
      WiServer.print_P(WEB_FAILED);
    return true;
  }
  if (strncmp_P(URL, URL_SETPOFF, 6) == 0 && urlLen > 8) 
  {
    if (storeProbeOffset(URL[6] - '0', atoi(URL + 8)))
      WiServer.print_P(WEB_OK);
    else
      WiServer.print_P(WEB_FAILED);
    return true;
  }
  if (strcmp(URL, "p") == 0) 
  {
    WiServer.print((double)pid._pidErrorSum, 3);
    return true;    
  }
  
  const struct flash_file_t *file = FLASHFILES;
  while (pgm_read_word(&file->fname))
  {
    if (strcmp_P(URL, (const prog_char *)pgm_read_word(&file->fname)) == 0)
    {
      sendFlashFile(file);
      return true;
    }
    ++file;
  }
  
  return false;
}
#endif /* HEATERMETER_NETWORKING */

void eepromLoadConfig(boolean forceDefault)
{
  struct __eeprom_data config;
  eeprom_read_block(&config, 0, sizeof(config));
  if (forceDefault || config.magic != EEPROM_MAGIC)
  {
    memcpy_P(&config, &DEFAULT_CONFIG, sizeof(config));
    eeprom_write_block(&config, 0, sizeof(config));  
  }

  unsigned char i;
  for (i=0; i<TEMP_COUNT; i++)
    pid.Probes[i]->Offset = config.probeTempOffsets[i];
    
  pid.setSetPoint(config.setPoint);
  pid.LidOpenOffset = config.lidOpenOffset;
  pid.LidOpenDuration = config.lidOpenDuration;
  pid.MaxFanSpeed = config.maxFanSpeed;
  memcpy(pid.Pid, config.pidConstants, sizeof(config.pidConstants));
  if (config.manualMode)
    pid.setFanSpeed(0);
}

void hmcoreSetup(void)
{
  pid.Probes[TEMP_PIT] = &probe0;
  pid.Probes[TEMP_FOOD1] = &probe1;
  pid.Probes[TEMP_FOOD2] = &probe2;
  pid.Probes[TEMP_AMB] = &probe3;
  
  pid.Probes[TEMP_PIT]->Alarms.setHigh(200);
  pid.Probes[TEMP_PIT]->Alarms.setLow(1);

  Serial.print(pid.Probes[TEMP_PIT]->Alarms.getHigh());
  Serial.print(pid.Probes[TEMP_PIT]->Alarms.getLow());

  eepromLoadConfig(false);

#ifdef HEATERMETER_NETWORKING
  // Set the WiFi Slave Select to HIGH (disable) to
  // prevent it from interferring with the dflash init
  pinMode(PIN_WIFI_SS, OUTPUT);
  digitalWrite(PIN_WIFI_SS, HIGH);
  dflash.init(PIN_DATAFLASH_SS);
  flashRingBufferInit();
  
  g_NetworkInitialized = readButton() == BUTTON_NONE;
  if (g_NetworkInitialized)  
  {
    Menus.setState(ST_CONNECTING);
    WiServer.init(sendPage);
  }
  else
#endif  /* HEATERMETER_NETWORKING */
    Menus.setState(ST_HOME_AMB);
}

void hmcoreLoop(void)
{
  Menus.doWork();
  if (pid.doWork())
  {
    updateDisplay();
#ifdef HEATERMETER_NETWORKING
    //storeTemps();
  }
  if (g_NetworkInitialized)
    WiServer.server_task(); 
#else
  }
#endif /* HEATERMETER_NETWORKING */
}