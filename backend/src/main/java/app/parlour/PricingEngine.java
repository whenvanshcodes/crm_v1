package app.parlour;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;

/** Pricing calculations shared by booking/session services. Amounts are prorated by minute with a minimum duration. */
public final class PricingEngine {
  private PricingEngine() {}

  public static BigDecimal calculate(BigDecimal hourlyRate, Instant start, Instant end, int minimumMinutes, BigDecimal discount) {
    if (hourlyRate == null || hourlyRate.signum() < 0) throw new IllegalArgumentException("Hourly rate must be zero or greater");
    if (start == null || end == null || !end.isAfter(start)) throw new IllegalArgumentException("End time must be after start time");
    if (minimumMinutes < 1) throw new IllegalArgumentException("Minimum duration must be positive");
    long actualMinutes = Math.max(1, (Duration.between(start, end).toSeconds() + 59) / 60);
    long chargeableMinutes = Math.max(actualMinutes, minimumMinutes);
    BigDecimal base = hourlyRate.multiply(BigDecimal.valueOf(chargeableMinutes)).divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
    BigDecimal safeDiscount = discount == null ? BigDecimal.ZERO : discount;
    if (safeDiscount.signum() < 0 || safeDiscount.compareTo(base) > 0) throw new IllegalArgumentException("Discount must be between zero and the base amount");
    return base.subtract(safeDiscount).setScale(2, RoundingMode.HALF_UP);
  }
}
