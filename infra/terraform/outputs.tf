output "region" {
  description = "AWS region the cluster is deployed in."
  value       = var.region
}

output "cluster_name" {
  description = "EKS cluster name."
  value       = module.eks.cluster_name
}

output "ecr_repository_url" {
  description = "ECR repository URL to build/push the API image to."
  value       = aws_ecr_repository.api.repository_url
}

output "configure_kubectl" {
  description = "Run this to point kubectl at the new cluster."
  value       = "aws eks update-kubeconfig --name ${module.eks.cluster_name} --region ${var.region}"
}
