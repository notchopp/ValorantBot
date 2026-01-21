-- Migration 014: Update rank thresholds for widened bands and Absolute/X system

DELETE FROM rank_thresholds;

INSERT INTO rank_thresholds (rank, min_mmr, max_mmr) VALUES
    ('GRNDS I', 0, 299),
    ('GRNDS II', 300, 599),
    ('GRNDS III', 600, 899),
    ('GRNDS IV', 900, 1199),
    ('GRNDS V', 1200, 1499),
    ('BREAKPOINT I', 1500, 1699),
    ('BREAKPOINT II', 1700, 1899),
    ('BREAKPOINT III', 1900, 2099),
    ('BREAKPOINT IV', 2100, 2299),
    ('BREAKPOINT V', 2300, 2399),
    ('CHALLENGER I', 2400, 2499),
    ('CHALLENGER II', 2500, 2599),
    ('CHALLENGER III', 2600, 2999),
    ('X', 3000, 99999)
ON CONFLICT (rank) DO UPDATE
SET min_mmr = EXCLUDED.min_mmr,
    max_mmr = EXCLUDED.max_mmr;
