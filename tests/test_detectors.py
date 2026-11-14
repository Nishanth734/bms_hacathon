"""Tests for the three typology detectors."""
from traceflow.detectors.fan_in_out import fan_in_out
from traceflow.detectors.cycle import cycle
from traceflow.detectors.pass_through import pass_through
from traceflow.detectors import run_all_detectors

def test_fan_out_found(planted_fanout_df, sample_config):
    clusters = fan_in_out(planted_fanout_df, sample_config)
    fan_outs = [c for c in clusters if "fan_out" in c.typology]
    assert len(fan_outs) >= 1
    assert "CentralBank_Hub1" in fan_outs[0].accounts

def test_cycle_found_time_ordered(planted_cycle_df, sample_config):
    cycles = cycle(planted_cycle_df, sample_config)
    assert len(cycles) >= 1
    assert "cycle" in cycles[0].typology
    assert len(cycles[0].accounts) == 3

def test_cycle_rejected_out_of_order(invalid_cycle_df, sample_config):
    cycles = cycle(invalid_cycle_df, sample_config)
    assert len(cycles) == 0

def test_pass_through_found_short_dwell(planted_passthrough_df, sample_config):
    chains = pass_through(planted_passthrough_df, sample_config)
    assert len(chains) >= 1
    assert "pass_through" in chains[0].typology

def test_run_all_detectors_merges(planted_fanout_df, sample_config):
    all_c = run_all_detectors(planted_fanout_df, sample_config)
    assert isinstance(all_c, list)
