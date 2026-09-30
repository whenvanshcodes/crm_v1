package app.parlour;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class PricingEngineTest {
  private static final Instant START = Instant.parse("2026-09-30T10:00:00Z");

  @Test void appliesMinimumHalfHourCharge() {
    assertEquals(new BigDecimal("210.00"), PricingEngine.calculate(new BigDecimal("420"), START, START.plusSeconds(60), 30, BigDecimal.ZERO));
  }
  @Test void proratesElapsedMinutesAndAppliesDiscount() {
    assertEquals(new BigDecimal("315.00"), PricingEngine.calculate(new BigDecimal("420"), START, START.plusSeconds(3600), 30, new BigDecimal("105")));
  }
  @Test void rejectsInvalidTimeAndDiscount() {
    assertThrows(IllegalArgumentException.class, () -> PricingEngine.calculate(new BigDecimal("420"), START, START, 30, BigDecimal.ZERO));
    assertThrows(IllegalArgumentException.class, () -> PricingEngine.calculate(new BigDecimal("420"), START, START.plusSeconds(60), 30, new BigDecimal("999")));
  }
}
