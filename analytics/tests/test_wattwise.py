import json
import unittest

from cost_engine import calculate_excess_cost
from demo_workflow import run_demo
from integration import WattWiseAnalyticsService
from report_generator import generate_html_report, generate_json_report


class CostEngineTests(unittest.TestCase):
    def test_normal_period_has_no_excess(self):
        result = calculate_excess_cost(90, 100, 8).to_dict()
        self.assertEqual(result["excessKwh"], 0)
        self.assertEqual(result["estimatedExcessCost"], 0)

    def test_demo_cost_and_different_tariffs(self):
        self.assertEqual(calculate_excess_cost(180, 100, 8).estimated_excess_cost, 640)
        self.assertEqual(calculate_excess_cost(180, 100, 5).estimated_excess_cost, 400)

    def test_missing_ml_and_tariff(self):
        self.assertEqual(calculate_excess_cost(180, None, 8).status, "missing_ml_output")
        no_tariff = calculate_excess_cost(180, 100, None)
        self.assertEqual(no_tariff.excess_kwh, 80)
        self.assertIsNone(no_tariff.estimated_excess_cost)
        self.assertEqual(no_tariff.status, "missing_tariff")


class IntegrationTests(unittest.TestCase):
    def test_anomaly_dashboard_detail_and_callback(self):
        events = []
        service = WattWiseAnalyticsService(8, "Block A", events.append)
        result = service.process_observation({
            "timestamp": "2026-10-02T22:00:00",
            "startTime": "2026-10-02T22:00:00",
            "endTime": "2026-10-03T00:00:00",
            "expectedKwh": 100,
            "actualKwh": 180,
            "isAnomaly": True,
        })
        self.assertEqual(result["anomaly"]["excessKwh"], 80)
        self.assertEqual(result["anomaly"]["estimatedCost"], 640)
        self.assertEqual(result["notificationStatus"], "sent")
        self.assertEqual(events[0]["type"], "anomaly.created")
        dashboard = service.get_dashboard_summary()
        self.assertEqual(dashboard["currentUsage"], 180)
        self.assertEqual(dashboard["expectedUsage"], 100)
        self.assertEqual(dashboard["excessEnergy"], 80)
        self.assertEqual(dashboard["estimatedExcessCost"], 640)
        self.assertEqual(dashboard["activeAnomalies"], 1)
        detail = service.get_anomaly_detail(result["anomaly"]["anomalyId"])
        self.assertTrue(any("approximately 2 hours" in item for item in detail["evidence"]))
        self.assertIn("Estimated Excess Cost is ₹640.00.", detail["evidence"])

    def test_multi_anomaly_and_no_anomaly(self):
        service = WattWiseAnalyticsService(8)
        service.process_batch([
            {"timestamp": "2026-10-01T10:00:00", "expectedKwh": 100, "actualKwh": 180, "isAnomaly": True},
            {"timestamp": "2026-10-02T10:00:00", "expectedKwh": 50, "actualKwh": 70, "isAnomaly": True},
            {"timestamp": "2026-10-03T10:00:00", "expectedKwh": 50, "actualKwh": 45, "isAnomaly": False},
        ])
        self.assertEqual(service.get_dashboard_summary()["activeAnomalies"], 2)
        self.assertEqual(service.get_dashboard_summary()["estimatedExcessCost"], 800)
        analytics = service.get_analytics()
        self.assertEqual(analytics["summary"]["totalExcessEnergyKwh"], 100)
        self.assertEqual(analytics["summary"]["averageExcessPerAnomalyKwh"], 50)
        empty = WattWiseAnalyticsService(8)
        self.assertEqual(empty.get_dashboard_summary()["estimatedExcessCost"], 0)
        self.assertIsNone(empty.get_dashboard_summary()["largestAnomaly"])
        self.assertEqual(empty.get_analytics()["summary"]["totalExcessEnergyKwh"], 0)

    def test_missing_outputs_and_zero_excess(self):
        service = WattWiseAnalyticsService()
        missing = service.process_observation({"timestamp": "2026-10-01T10:00:00", "actualKwh": 4})
        self.assertEqual(missing["status"], "missing_ml_output")
        no_tariff = service.process_observation({
            "timestamp": "2026-10-01T10:00:00", "expectedKwh": 100,
            "actualKwh": 100, "isAnomaly": True,
        })
        self.assertEqual(no_tariff["status"], "missing_tariff")
        self.assertEqual(no_tariff["observation"]["excessKwh"], 0)
        self.assertIsNone(service.get_dashboard_summary()["estimatedExcessCost"])

    def test_daily_weekly_monthly_and_custom_analytics(self):
        service = WattWiseAnalyticsService(2)
        service.process_batch([
            {"timestamp": "2026-01-05T10:00:00", "expectedKwh": 10, "actualKwh": 15, "isAnomaly": True},
            {"timestamp": "2026-01-12T10:00:00", "expectedKwh": 10, "actualKwh": 12, "isAnomaly": True},
            {"timestamp": "2026-02-02T10:00:00", "expectedKwh": 10, "actualKwh": 10, "isAnomaly": False},
        ])
        analytics = service.get_analytics("2026-01-05", "2026-01-12")
        self.assertEqual(len(analytics["charts"]["dailyTrends"]), 2)
        self.assertEqual(len(analytics["charts"]["weeklyTrends"]), 2)
        self.assertEqual(len(analytics["charts"]["monthlyTrends"]), 1)
        self.assertEqual(analytics["summary"]["customPeriod"]["totalExcessEnergyKwh"], 7)

    def test_reports_escape_html_and_keep_cautious_language(self):
        anomaly = {
            "anomalyId": "AN-X", "startTime": "2026-10-02T22:00:00",
            "endTime": "2026-10-03T00:00:00", "expectedKwh": 100,
            "actualKwh": 180, "tariffPerKwh": 8, "building": "<Block A>",
        }
        report = json.loads(generate_json_report(anomaly, building="Block A"))
        self.assertEqual(report["estimatedExcessCost"], 640)
        self.assertIn("does not establish the physical cause", report["disclaimer"])
        page = generate_html_report(anomaly, building="<Block A>")
        self.assertIn("&lt;Block A&gt;", page)
        self.assertNotIn("Guaranteed Loss", page)

    def test_demo_workflow_values_are_consistent(self):
        demo = run_demo()
        self.assertEqual(demo["dashboard"]["currentUsage"], 180)
        self.assertEqual(demo["dashboard"]["expectedUsage"], 100)
        self.assertEqual(demo["dashboard"]["excessEnergy"], 80)
        self.assertEqual(demo["dashboard"]["estimatedExcessCost"], 640)
        self.assertEqual(demo["anomaly"]["estimatedCost"], 640)
        self.assertEqual(demo["investigationBrief"]["estimatedExcessCost"], 640)
        self.assertEqual(demo["notificationCount"], 1)


if __name__ == "__main__":
    unittest.main()
