require("nixio")
require("luci.util")

LmClient = luci.util.class()

function LmClient._connect(self)
  if self.sock then return true end
 
  local sock = nixio.socket("unix", "dgram")
  -- autobind to an abstract address, optionally I could explicitly specify
  -- an abstract name such as "\0linkmeter"..pid
  -- Abstract socket namespace is only supported on Linux
  sock:bind("")
  if not sock:connect("/var/run/linkmeter.sock") then
    sock:close()
    return nil, "connect"
  end
  
  self.sock = sock
  return true
end

function LmClient.close(self)
  if self.sock then
    self.sock:close()
    self.sock = nil
  end
end

function LmClient.query(self, qry, autoclose)
  local r = {self:_connect()}
  if not r[1] then return unpack(r) end
  
  if self.sock:send(qry) == 0 then
    return nil, "send"
  end
  
  local polle = { fd = self.sock, events = nixio.poll_flags("in") }
  if nixio.poll({polle}, 1000) then
    r = self.sock:recv(1024)
  else
    r = { nil, "poll" }
  end
  
  if autoclose then self:close() end
  return r
end

-- Command line execution
if arg then
  local qry = arg[1] or "$LMSU"
  if qry:sub(1,1) ~= "$" then 
    qry = "$" .. qry
  end
  print(LmClient():query(qry, true))
end
