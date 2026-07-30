provider "aws" {
  region = var.region
}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  # Use up to three AZs for the demo.
  azs = slice(data.aws_availability_zones.available.names, 0, 3)
}

########################################
# Networking
########################################
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.8"

  name = "${var.cluster_name}-vpc"
  cidr = var.vpc_cidr

  azs             = local.azs
  public_subnets  = [for k, v in local.azs : cidrsubnet(var.vpc_cidr, 8, k)]
  private_subnets = [for k, v in local.azs : cidrsubnet(var.vpc_cidr, 8, k + 10)]

  enable_nat_gateway   = true
  single_nat_gateway   = true # cost-minimal for a demo
  enable_dns_hostnames = true

  # Subnet tags required for EKS load balancer discovery.
  public_subnet_tags = {
    "kubernetes.io/role/elb" = "1"
  }
  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = "1"
  }

  tags = var.tags
}

########################################
# EKS cluster + EC2 managed node group
########################################
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.8"

  cluster_name    = var.cluster_name
  cluster_version = var.kubernetes_version

  # Public API endpoint so you can run kubectl / kube inject from your machine.
  cluster_endpoint_public_access = true

  # Grant the identity running `terraform apply` admin access to the cluster.
  enable_cluster_creator_admin_permissions = true

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  # EC2 managed node group. The Postman Insights agent captures packets and
  # needs the NET_RAW capability, which AWS Fargate does not allow — so this
  # demo intentionally uses EC2 nodes, not a Fargate profile.
  eks_managed_node_groups = {
    default = {
      instance_types = [var.node_instance_type]
      min_size       = var.node_min_size
      max_size       = var.node_max_size
      desired_size   = var.node_desired_size
    }
  }

  tags = var.tags
}

########################################
# Container registry
########################################
resource "aws_ecr_repository" "api" {
  name                 = var.ecr_repository_name
  image_tag_mutability = "MUTABLE"
  force_delete         = true # demo: allow `terraform destroy` to remove images too

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = var.tags
}
