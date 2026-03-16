"""Cognito User Pool Stack for SpiderFlow authentication."""
import aws_cdk as cdk
from aws_cdk import (
    aws_cognito as cognito,
    CfnOutput,
)
from constructs import Construct


class CognitoStack(cdk.Stack):
    """Creates the Cognito User Pool and App Client for SpiderFlow."""

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # ── Cognito User Pool ──
        self.user_pool = cognito.UserPool(
            self,
            "SpiderFlowUserPool",
            user_pool_name="spiderflow-users",
            self_sign_up_enabled=True,
            sign_in_aliases=cognito.SignInAliases(email=True),
            auto_verify=cognito.AutoVerifiedAttrs(email=True),
            standard_attributes=cognito.StandardAttributes(
                email=cognito.StandardAttribute(required=True, mutable=True),
                fullname=cognito.StandardAttribute(required=False, mutable=True),
            ),
            password_policy=cognito.PasswordPolicy(
                min_length=8,
                require_lowercase=True,
                require_uppercase=True,
                require_digits=True,
                require_symbols=False,
            ),
            account_recovery=cognito.AccountRecovery.EMAIL_ONLY,
            removal_policy=cdk.RemovalPolicy.DESTROY,
        )

        # ── App Client ──
        self.user_pool_client = self.user_pool.add_client(
            "SpiderFlowWebClient",
            user_pool_client_name="spiderflow-web-client",
            auth_flows=cognito.AuthFlow(
                user_password=True,
                user_srp=True,
            ),
            o_auth=cognito.OAuthSettings(
                flows=cognito.OAuthFlows(authorization_code_grant=True),
                scopes=[cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
                callback_urls=["http://localhost:3000/"],
                logout_urls=["http://localhost:3000/"],
            ),
            prevent_user_existence_errors=True,
        )

        # ── Outputs ──
        CfnOutput(self, "UserPoolId", value=self.user_pool.user_pool_id)
        CfnOutput(self, "UserPoolClientId", value=self.user_pool_client.user_pool_client_id)
