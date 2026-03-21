package service

import (
	"testing"
	"time"

	"github.com/natthaohong/delivery-food/go_backend/internal/model"
	"github.com/natthaohong/delivery-food/go_backend/internal/repository"
)

func TestComputePayrollCalculationForHourlyEmployee(t *testing.T) {
	hourlyWage := 120.0
	period := model.PayrollPeriod{
		StartsAt: time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC),
		EndsAt:   time.Date(2026, 3, 15, 0, 0, 0, 0, time.UTC),
	}
	settings := model.PayrollSettings{
		StandardDailyMinutes:    480,
		StandardMonthlyMinutes:  9600,
		OvertimeRoundingMinutes: 30,
		DefaultOTMultiplier:     1.5,
	}
	input := repository.PayrollComputationInput{
		CompensationType:  "hourly",
		HourlyWage:        &hourlyWage,
		OTEligible:        true,
		OTMultiplier:      2,
		AttendanceMinutes: 540,
		ApprovedOTMinutes: 95,
	}

	result := ComputePayrollCalculation(input, period, settings, 50)

	if result.AttendanceMinutes != 540 {
		t.Fatalf("AttendanceMinutes = %d, want 540", result.AttendanceMinutes)
	}
	if result.RegularMinutes != 540 {
		t.Fatalf("RegularMinutes = %d, want 540", result.RegularMinutes)
	}
	if result.OvertimeMinutes != 90 {
		t.Fatalf("OvertimeMinutes = %d, want 90 after rounding", result.OvertimeMinutes)
	}
	if result.RegularAmount != 1080 {
		t.Fatalf("RegularAmount = %.2f, want 1080.00", result.RegularAmount)
	}
	if result.OvertimeAmount != 360 {
		t.Fatalf("OvertimeAmount = %.2f, want 360.00", result.OvertimeAmount)
	}
	if result.GrossAmount != 1490 {
		t.Fatalf("GrossAmount = %.2f, want 1490.00", result.GrossAmount)
	}
}

func TestComputePayrollCalculationForSalaryEmployee(t *testing.T) {
	monthlySalary := 30000.0
	period := model.PayrollPeriod{
		StartsAt: time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC),
		EndsAt:   time.Date(2026, 3, 30, 0, 0, 0, 0, time.UTC),
	}
	settings := model.PayrollSettings{
		StandardDailyMinutes:    480,
		StandardMonthlyMinutes:  9600,
		OvertimeRoundingMinutes: 30,
		DefaultOTMultiplier:     1.5,
	}
	input := repository.PayrollComputationInput{
		CompensationType:  "salary",
		MonthlySalary:     &monthlySalary,
		OTEligible:        true,
		AttendanceMinutes: 9800,
		ApprovedOTMinutes: 75,
	}

	result := ComputePayrollCalculation(input, period, settings, -250)

	if result.RegularMinutes != 9600 {
		t.Fatalf("RegularMinutes = %d, want 9600 monthly standard minutes", result.RegularMinutes)
	}
	if result.OvertimeMinutes != 60 {
		t.Fatalf("OvertimeMinutes = %d, want 60 after rounding", result.OvertimeMinutes)
	}
	if result.RegularAmount != 30000 {
		t.Fatalf("RegularAmount = %.2f, want 30000.00", result.RegularAmount)
	}
	if result.OvertimeAmount <= 0 {
		t.Fatalf("OvertimeAmount = %.2f, want positive overtime pay", result.OvertimeAmount)
	}
	if result.GrossAmount != roundMoney(result.RegularAmount+result.OvertimeAmount-250) {
		t.Fatalf("GrossAmount = %.2f, want regular + overtime - adjustment", result.GrossAmount)
	}
}
