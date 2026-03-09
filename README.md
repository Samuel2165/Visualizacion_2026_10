Los datos de suicidios están en:

https://www.datos.gov.co/resource/fhc4-jjti.csv?$query=SELECT%0A%20%20%60cod_eve%60%2C%0A%20%20%60nombre_evento%60%2C%0A%20%20%60semana%60%2C%0A%20%20%60ano%60%2C%0A%20%20%60municipio_ocurrencia%60%2C%0A%20%20%60departamento_ocurrencia%60%2C%0A%20%20%60conteo%60%0AWHERE%20caseless_eq(%60nombre_evento%60%2C%20%22INTENTO%20DE%20SUICIDIO%22)