package k8s

import (
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
)

func isAlreadyExists(err error) bool {
	return k8serrors.IsAlreadyExists(err)
}

func isNotFound(err error) bool {
	return k8serrors.IsNotFound(err)
}
