package models

import (
	"fmt"
	"regexp"
)

var instanceNameRegex = regexp.MustCompile(`^[a-z][a-z0-9_-]{0,62}$`)

// ValidateInstanceName checks that an instance name is URL-safe and follows
// our naming convention.
func ValidateInstanceName(name string) error {
	if name == "" {
		return fmt.Errorf("instance name is required")
	}
	if !instanceNameRegex.MatchString(name) {
		return fmt.Errorf("instance name must be lowercase, start with a letter, " +
			"and contain only letters, digits, hyphens, or underscores (max 63 chars)")
	}
	reserved := map[string]bool{
		"auth": true, "rest": true, "api": true, "admin": true,
		"v1": true, "system": true, "public": true,
	}
	if reserved[name] {
		return fmt.Errorf("instance name %q is reserved", name)
	}
	return nil
}
