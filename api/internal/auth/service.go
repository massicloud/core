package auth

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/mikaminou/massicloud/api/internal/config"
	"github.com/mikaminou/massicloud/api/internal/models"
	"github.com/mikaminou/massicloud/api/internal/store"
)

type Service struct {
	store  *store.Store
	config *config.Config
	logger *slog.Logger
}

func New(store *store.Store, cfg *config.Config, logger *slog.Logger) *Service {
	return &Service{store: store, config: cfg, logger: logger}
}

func (s *Service) Register(ctx context.Context, req models.RegisterRequest) (models.User, error) {
	if req.Email == "" {
		return models.User{}, fmt.Errorf("auth: email is required")
	}
	if len(req.Password) < 8 {
		return models.User{}, fmt.Errorf("auth: password must be at least 8 characters")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return models.User{}, fmt.Errorf("auth: hash password: %w", err)
	}

	user := models.User{
		ID:        uuid.New().String(),
		Email:     req.Email,
		Password:  string(hash),
		FullName:  req.FullName,
		Role:      models.RoleAdmin,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := s.store.CreateUser(ctx, user); err != nil {
		return models.User{}, fmt.Errorf("auth: create user: %w", err)
	}

	s.logger.Info("user registered",
		slog.String("id", user.ID),
		slog.String("email", user.Email),
	)

	user.Password = ""
	return user, nil
}

func (s *Service) Login(ctx context.Context, req models.LoginRequest) (models.LoginResponse, error) {
	if req.Email == "" || req.Password == "" {
		return models.LoginResponse{}, fmt.Errorf("auth: email and password required")
	}

	user, err := s.store.GetUserByEmail(ctx, req.Email)
	if err != nil {
		return models.LoginResponse{}, fmt.Errorf("auth: invalid credentials")
	}

	if err := bcrypt.CompareHashAndPassword(
		[]byte(user.Password), []byte(req.Password)); err != nil {
		return models.LoginResponse{}, fmt.Errorf("auth: invalid credentials")
	}

	token, err := s.generateToken(user)
	if err != nil {
		return models.LoginResponse{}, fmt.Errorf("auth: generate token: %w", err)
	}

	s.logger.Info("user logged in", slog.String("email", user.Email))

	user.Password = ""
	return models.LoginResponse{Token: token, User: user}, nil
}

func (s *Service) ValidateToken(tokenStr string) (*models.Claims, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("auth: unexpected signing method")
		}
		return []byte(s.config.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, fmt.Errorf("auth: invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("auth: invalid claims")
	}

	return &models.Claims{
		UserID: claims["user_id"].(string),
		Email:  claims["email"].(string),
		Role:   models.UserRole(claims["role"].(string)),
	}, nil
}

func (s *Service) generateToken(user models.User) (string, error) {
	claims := jwt.MapClaims{
		"user_id": user.ID,
		"email":   user.Email,
		"role":    string(user.Role),
		"exp":     time.Now().Add(s.config.TokenExpiry).Unix(),
		"iat":     time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.config.JWTSecret))
}
