package initschemas

type SchemaPreset struct {
	ID           string   `json:"id"`
	Label        string   `json:"label"`
	Description  string   `json:"description"`
	Schemas      []string `json:"schemas"`
	DatabaseType string   `json:"database_type"` // "postgres"
}

var Presets = map[string]SchemaPreset{
	"blank": {
		ID:           "blank",
		Label:        "Blank",
		Description:  "Empty database. Extensions still installed.",
		Schemas:      []string{},
		DatabaseType: "postgres",
	},
	"auth_basic": {
		ID:           "auth_basic",
		Label:        "Auth + basic",
		Description:  "Authentication schema with auth.users table.",
		Schemas:      []string{"auth"},
		DatabaseType: "postgres",
	},
	"auth_audit_compliance": {
		ID:           "auth_audit_compliance",
		Label:        "Auth + audit + compliance",
		Description:  "Full ANPDP-ready setup: auth, audit trail, compliance tracking.",
		Schemas:      []string{"auth", "audit", "compliance"},
		DatabaseType: "postgres",
	},
}

func GetPreset(id string) (SchemaPreset, bool) {
	p, ok := Presets[id]
	return p, ok
}

// ListPresets returns every Postgres preset.
func ListPresets() []SchemaPreset {
	order := []string{"blank", "auth_basic", "auth_audit_compliance"}
	result := make([]SchemaPreset, 0, len(order))
	for _, id := range order {
		result = append(result, Presets[id])
	}
	return result
}

// ListAllPresets returns every schema preset, tagged with database_type so
// the portal can filter by the selected instance type.
func ListAllPresets() []SchemaPreset {
	all := ListPresets()
	return append(all, ListMongoPresets()...)
}
