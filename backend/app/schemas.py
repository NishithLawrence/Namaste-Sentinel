from datetime import datetime
from pydantic import BaseModel, Field
class TelemetryIn(BaseModel):
    timestamp: datetime
    site_id: str = Field(min_length=1, max_length=80)
    h2s: float; ch4: float; o2: float; temperature: float; humidity: float
class SimulationEvent(BaseModel):
    site_id: str = 'MANHOLE-01'
    mode: str = Field(pattern='^(normal|rise|decline|noise|recovery)$')
    points: int = Field(default=12, ge=1, le=120)
class AcknowledgeResponse(BaseModel):
    success: bool; message: str
