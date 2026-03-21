package service

import (
	"math"
	"time"

	"github.com/natthaohong/delivery-food/go_backend/internal/model"
	"github.com/natthaohong/delivery-food/go_backend/internal/repository"
)

type PayrollCalculation struct {
	AttendanceMinutes int
	RegularMinutes    int
	OvertimeMinutes   int
	RegularAmount     float64
	OvertimeAmount    float64
	AdjustmentAmount  float64
	GrossAmount       float64
}

func ComputePayrollCalculation(
	input repository.PayrollComputationInput,
	period model.PayrollPeriod,
	settings model.PayrollSettings,
	adjustmentAmount float64,
) PayrollCalculation {
	periodDays := int(period.EndsAt.Sub(period.StartsAt).Hours()/24) + 1
	if periodDays <= 0 {
		periodDays = 1
	}

	attendanceMinutes := maxInt(input.AttendanceMinutes, 0)
	roundedOT := 0
	if input.OTEligible {
		roundedOT = roundDownMinutes(maxInt(input.ApprovedOTMinutes, 0), maxInt(settings.OvertimeRoundingMinutes, 1))
	}

	result := PayrollCalculation{
		AttendanceMinutes: attendanceMinutes,
		AdjustmentAmount:  adjustmentAmount,
	}

	switch input.CompensationType {
	case "salary":
		periodStandardMinutes := int(math.Round(float64(settings.StandardMonthlyMinutes) * float64(periodDays) / 30.0))
		if periodStandardMinutes <= 0 {
			periodStandardMinutes = settings.StandardDailyMinutes * periodDays
		}
		result.RegularMinutes = minInt(attendanceMinutes, periodStandardMinutes)
		if input.MonthlySalary != nil {
			result.RegularAmount = roundMoney(*input.MonthlySalary * float64(periodDays) / 30.0)
		}
		baseHourly := 0.0
		if input.MonthlySalary != nil && settings.StandardMonthlyMinutes > 0 {
			baseHourly = *input.MonthlySalary / (float64(settings.StandardMonthlyMinutes) / 60.0)
		}
		result.OvertimeMinutes = roundedOT
		result.OvertimeAmount = roundMoney(baseHourly * resolveOTMultiplier(input, settings) * float64(roundedOT) / 60.0)
	default:
		result.RegularMinutes = attendanceMinutes
		if input.HourlyWage != nil {
			result.RegularAmount = roundMoney(*input.HourlyWage * float64(attendanceMinutes) / 60.0)
			result.OvertimeMinutes = roundedOT
			result.OvertimeAmount = roundMoney(*input.HourlyWage * resolveOTMultiplier(input, settings) * float64(roundedOT) / 60.0)
		}
	}

	result.GrossAmount = roundMoney(result.RegularAmount + result.OvertimeAmount + adjustmentAmount)
	return result
}

func resolveOTMultiplier(input repository.PayrollComputationInput, settings model.PayrollSettings) float64 {
	if input.OTMultiplier > 0 {
		return input.OTMultiplier
	}
	if settings.DefaultOTMultiplier > 0 {
		return settings.DefaultOTMultiplier
	}
	return 1
}

func roundDownMinutes(value int, interval int) int {
	if interval <= 0 {
		return maxInt(value, 0)
	}
	return (maxInt(value, 0) / interval) * interval
}

func roundMoney(value float64) float64 {
	return math.Round(value*100) / 100
}

func minInt(a int, b int) int {
	if a < b {
		return a
	}
	return b
}

func maxInt(a int, b int) int {
	if a > b {
		return a
	}
	return b
}

func parseISODate(value string) (time.Time, error) {
	return time.Parse("2006-01-02", value)
}

func parseISODateTime(value string) (time.Time, error) {
	return time.Parse(time.RFC3339, value)
}
