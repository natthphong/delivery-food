package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"gitlab.com/home-server7795544/home-server/iam/iam-backend/internal/authjwt"
)

func AuthRequired(secret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		auth := c.Get("Authorization")
		if auth == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"code": "UNAUTHORIZED", "message": "missing token"})
		}
		token := strings.TrimSpace(strings.TrimPrefix(auth, "Bearer"))
		claims, err := authjwt.Parse(secret, token)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"code": "UNAUTHORIZED", "message": "invalid token"})
		}
		c.Locals("userId", claims.UserID)
		c.Locals("email", claims.Email)
		c.Locals("fullName", claims.FullName)
		return c.Next()
	}
}
