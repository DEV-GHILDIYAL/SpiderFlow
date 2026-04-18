"""WAF Stack: AWS Web Application Firewall for API Gateway and CloudFront."""
import aws_cdk as cdk
from aws_cdk import aws_wafv2 as wafv2, CfnOutput
from constructs import Construct

class WafStack(cdk.Stack):
    """Web Application Firewall protecting regional APIs and global CDNs."""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        api_gateway_arn: str,
        cloudfront_distribution_id: str,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # ── REGIONAL WebACL (API Gateway) ──
        regional_web_acl = wafv2.CfnWebACL(
            self,
            "SpiderFlowWebACL",
            name="SpiderFlowWebACL",
            scope="REGIONAL",
            default_action=wafv2.CfnWebACL.DefaultActionProperty(allow={}),
            visibility_config=wafv2.CfnWebACL.VisibilityConfigProperty(
                cloud_watch_metrics_enabled=True,
                metric_name="SpiderFlowWebACL",
                sampled_requests_enabled=True,
            ),
            rules=[
                # 1. AWSManagedRulesCommonRuleSet
                wafv2.CfnWebACL.RuleProperty(
                    name="AWSManagedRulesCommonRuleSet",
                    priority=1,
                    override_action=wafv2.CfnWebACL.OverrideActionProperty(none={}),
                    statement=wafv2.CfnWebACL.StatementProperty(
                        managed_rule_group_statement=wafv2.CfnWebACL.ManagedRuleGroupStatementProperty(
                            vendor_name="AWS",
                            name="AWSManagedRulesCommonRuleSet"
                        )
                    ),
                    visibility_config=wafv2.CfnWebACL.VisibilityConfigProperty(
                        cloud_watch_metrics_enabled=True,
                        metric_name="AWSManagedRulesCommonRuleSetMetrics",
                        sampled_requests_enabled=True,
                    )
                ),
                # 2. AWSManagedRulesKnownBadInputsRuleSet
                wafv2.CfnWebACL.RuleProperty(
                    name="AWSManagedRulesKnownBadInputsRuleSet",
                    priority=2,
                    override_action=wafv2.CfnWebACL.OverrideActionProperty(none={}),
                    statement=wafv2.CfnWebACL.StatementProperty(
                        managed_rule_group_statement=wafv2.CfnWebACL.ManagedRuleGroupStatementProperty(
                            vendor_name="AWS",
                            name="AWSManagedRulesKnownBadInputsRuleSet"
                        )
                    ),
                    visibility_config=wafv2.CfnWebACL.VisibilityConfigProperty(
                        cloud_watch_metrics_enabled=True,
                        metric_name="AWSManagedRulesKnownBadInputsRuleSetMetrics",
                        sampled_requests_enabled=True,
                    )
                ),
                # 3. AWSManagedRulesAmazonIpReputationList
                wafv2.CfnWebACL.RuleProperty(
                    name="AWSManagedRulesAmazonIpReputationList",
                    priority=3,
                    override_action=wafv2.CfnWebACL.OverrideActionProperty(none={}),
                    statement=wafv2.CfnWebACL.StatementProperty(
                        managed_rule_group_statement=wafv2.CfnWebACL.ManagedRuleGroupStatementProperty(
                            vendor_name="AWS",
                            name="AWSManagedRulesAmazonIpReputationList"
                        )
                    ),
                    visibility_config=wafv2.CfnWebACL.VisibilityConfigProperty(
                        cloud_watch_metrics_enabled=True,
                        metric_name="AWSManagedRulesAmazonIpReputationListMetrics",
                        sampled_requests_enabled=True,
                    )
                ),
                # 4. Rate Limiting 1000 requests per 5 mins
                wafv2.CfnWebACL.RuleProperty(
                    name="RateLimitRule",
                    priority=4,
                    action=wafv2.CfnWebACL.RuleActionProperty(block={}),
                    statement=wafv2.CfnWebACL.StatementProperty(
                        rate_based_statement=wafv2.CfnWebACL.RateBasedStatementProperty(
                            limit=1000,
                            aggregate_key_type="IP"
                        )
                    ),
                    visibility_config=wafv2.CfnWebACL.VisibilityConfigProperty(
                        cloud_watch_metrics_enabled=True,
                        metric_name="RateLimitRuleMetrics",
                        sampled_requests_enabled=True,
                    )
                )
            ]
        )

        # Associate regional WebACL with the API Gateway Stage ARN
        wafv2.CfnWebACLAssociation(
            self,
            "ApiGatewayWafAssociation",
            resource_arn=api_gateway_arn,
            web_acl_arn=regional_web_acl.attr_arn
        )

        # ── CLOUDFRONT WebACL (MUST BE IN us-east-1) ──
        # Important: The user must ensure this stack is deployed securely to us-east-1!
        # CloudFront strictly requires 'CLOUDFRONT' scoped WebACLs to be in the us-east-1 region.
        cf_web_acl = wafv2.CfnWebACL(
            self,
            "SpiderFlowCDNWebACL",
            name="SpiderFlowCDNWebACL",
            scope="CLOUDFRONT",
            default_action=wafv2.CfnWebACL.DefaultActionProperty(allow={}),
            visibility_config=wafv2.CfnWebACL.VisibilityConfigProperty(
                cloud_watch_metrics_enabled=True,
                metric_name="SpiderFlowCDNWebACL",
                sampled_requests_enabled=True,
            ),
            rules=[
                # 1. AWSManagedRulesCommonRuleSet
                wafv2.CfnWebACL.RuleProperty(
                    name="AWSManagedRulesCommonRuleSetCF",
                    priority=1,
                    override_action=wafv2.CfnWebACL.OverrideActionProperty(none={}),
                    statement=wafv2.CfnWebACL.StatementProperty(
                        managed_rule_group_statement=wafv2.CfnWebACL.ManagedRuleGroupStatementProperty(
                            vendor_name="AWS",
                            name="AWSManagedRulesCommonRuleSet"
                        )
                    ),
                    visibility_config=wafv2.CfnWebACL.VisibilityConfigProperty(
                        cloud_watch_metrics_enabled=True,
                        metric_name="AWSManagedRulesCommonRuleSetCFMetrics",
                        sampled_requests_enabled=True,
                    )
                ),
                # 2. AWSManagedRulesAmazonIpReputationList
                wafv2.CfnWebACL.RuleProperty(
                    name="AWSManagedRulesAmazonIpReputationListCF",
                    priority=2,
                    override_action=wafv2.CfnWebACL.OverrideActionProperty(none={}),
                    statement=wafv2.CfnWebACL.StatementProperty(
                        managed_rule_group_statement=wafv2.CfnWebACL.ManagedRuleGroupStatementProperty(
                            vendor_name="AWS",
                            name="AWSManagedRulesAmazonIpReputationList"
                        )
                    ),
                    visibility_config=wafv2.CfnWebACL.VisibilityConfigProperty(
                        cloud_watch_metrics_enabled=True,
                        metric_name="AWSManagedRulesAmazonIpReputationListCFMetrics",
                        sampled_requests_enabled=True,
                    )
                ),
                # 3. Rate Limiting 1000 requests per 5 mins
                wafv2.CfnWebACL.RuleProperty(
                    name="RateLimitRuleCF",
                    priority=3,
                    action=wafv2.CfnWebACL.RuleActionProperty(block={}),
                    statement=wafv2.CfnWebACL.StatementProperty(
                        rate_based_statement=wafv2.CfnWebACL.RateBasedStatementProperty(
                            limit=1000,
                            aggregate_key_type="IP"
                        )
                    ),
                    visibility_config=wafv2.CfnWebACL.VisibilityConfigProperty(
                        cloud_watch_metrics_enabled=True,
                        metric_name="RateLimitRuleCFMetrics",
                        sampled_requests_enabled=True,
                    )
                )
            ]
        )

        # ── Outputs ──
        CfnOutput(self, "RegionalWebAclArn", value=regional_web_acl.attr_arn)
        CfnOutput(self, "CloudfrontWebAclArn", value=cf_web_acl.attr_arn)
