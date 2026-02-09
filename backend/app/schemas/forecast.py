from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    """Payload sent from frontend when user clicks Analyze Property."""

    analyze_as: str = Field(..., description="Role: tenant | landlord | broker")
    property_name: str = Field(..., description="Property name")
    address: str = Field(..., description="Property address")
    leasable_area: str = Field(..., description="Leasable area in sq ft")
    current_base_rent: str = Field(..., description="Current base rent $/sf")
    file_names: list[str] = Field(default_factory=list, description="Names of uploaded context documents")
