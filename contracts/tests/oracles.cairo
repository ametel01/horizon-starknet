/// Oracle test module
///
/// Contains unit tests for oracle integrations:
/// - Pragma TWAP oracle for yield index
/// - Mock Pragma oracle for testing
/// - PT/YT/LP TWAP oracle helper
///
/// Run with: snforge test oracles

pub mod test_mock_pragma;
pub mod test_pragma_index_oracle;
pub mod test_pt_yt_lp_oracle;
pub mod test_pt_yt_lp_oracle_factory;
pub mod test_py_lp_oracle;
