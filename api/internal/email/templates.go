package email

import (
	"bytes"
	"embed"
	htmltemplate "html/template"
	texttemplate "text/template"
)

//go:embed templates/password-reset.html templates/password-reset.txt
var templateFS embed.FS

var (
	passwordResetHTML = htmltemplate.Must(htmltemplate.ParseFS(templateFS, "templates/password-reset.html"))
	passwordResetText = texttemplate.Must(texttemplate.ParseFS(templateFS, "templates/password-reset.txt"))
)

// PasswordResetData is the template input for the password reset email.
type PasswordResetData struct {
	FullName string
	ResetURL string
}

// RenderPasswordReset returns the HTML and plain-text bodies.
func RenderPasswordReset(data PasswordResetData) (htmlBody, textBody string, err error) {
	var h, t bytes.Buffer
	if err = passwordResetHTML.Execute(&h, data); err != nil {
		return "", "", err
	}
	if err = passwordResetText.Execute(&t, data); err != nil {
		return "", "", err
	}
	return h.String(), t.String(), nil
}
