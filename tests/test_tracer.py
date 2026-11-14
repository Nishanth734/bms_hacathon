"""Tests for TraceFlow forward tracer."""
import math
from traceflow.tracer import TraceFlow

def test_tracer_finds_planted_chain(planted_passthrough_df, sample_config):
    tracer = TraceFlow(sample_config)
    clusters = tracer.trace(planted_passthrough_df)
    assert len(clusters) >= 1
    c = clusters[0]
    assert c.dwell is not None
    assert c.retention is not None

def test_tracer_rejects_out_of_order(invalid_cycle_df, sample_config):
    tracer = TraceFlow(sample_config)
    clusters = tracer.trace(invalid_cycle_df)
    # The invalid cycle is out of time order so it won't be completed forward
    assert len(clusters) == 0

def test_dwell_computed_correctly(planted_passthrough_df, sample_config):
    tracer = TraceFlow(sample_config)
    clusters = tracer.trace(planted_passthrough_df)
    assert len(clusters) >= 1
    for dwell in clusters[0].dwell.values():
        assert dwell >= 0.0
