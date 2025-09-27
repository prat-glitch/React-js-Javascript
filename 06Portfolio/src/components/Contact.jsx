import React, { useState } from 'react';
import { Typography, Container, Grid, Card, CardContent, TextField, Button, Box, IconButton } from '@mui/material';
import { Email as EmailIcon, Phone as PhoneIcon, LocationOn as LocationIcon, GitHub as GitHubIcon, LinkedIn as LinkedInIcon, Twitter as TwitterIcon } from '@mui/icons-material';
import { motion } from 'framer-motion';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle form submission here
    console.log('Form submitted:', formData);
  };

  const contactInfo = [
    {
      icon: <EmailIcon className="w-6 h-6 text-purple-400" />,
      title: 'Email',
      value: 'john.doe@example.com',
      link: 'mailto:john.doe@example.com'
    },
    {
      icon: <PhoneIcon className="w-6 h-6 text-purple-400" />,
      title: 'Phone',
      value: '+1 (555) 123-4567',
      link: 'tel:+15551234567'
    },
    {
      icon: <LocationIcon className="w-6 h-6 text-purple-400" />,
      title: 'Location',
      value: 'San Francisco, CA',
      link: '#'
    }
  ];

  const socialLinks = [
    { icon: <GitHubIcon />, link: '#', label: 'GitHub' },
    { icon: <LinkedInIcon />, link: '#', label: 'LinkedIn' },
    { icon: <TwitterIcon />, link: '#', label: 'Twitter' }
  ];

  return (
    <section id="contact" className="py-20 bg-gray-800">
      <Container maxWidth="lg">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <Typography variant="h2" className="text-4xl md:text-5xl font-bold text-white mb-6">
            Get In <span className="text-gradient">Touch</span>
          </Typography>
          <Typography variant="body1" className="text-gray-400 text-lg max-w-3xl mx-auto leading-relaxed">
            I'm always open to discussing new opportunities, interesting projects, or just having a chat about technology.
          </Typography>
        </motion.div>

        <Grid container spacing={4}>
          <Grid item xs={12} md={8}>
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
              viewport={{ once: true }}
            >
              <Card className="glass-effect hover-lift">
                <CardContent className="p-10">
                  <Typography variant="h4" className="text-white font-bold mb-6">
                    Send Me a Message
                  </Typography>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <Grid container spacing={3}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          name="name"
                          label="Your Name"
                          value={formData.name}
                          onChange={handleChange}
                          variant="outlined"
                          className="bg-gray-700/50 rounded-lg"
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: 'white',
                              '& fieldset': {
                                borderColor: 'rgba(147, 51, 234, 0.3)',
                              },
                              '&:hover fieldset': {
                                borderColor: 'rgba(147, 51, 234, 0.5)',
                              },
                              '&.Mui-focused fieldset': {
                                borderColor: '#9333ea',
                              },
                            },
                            '& .MuiInputLabel-root': {
                              color: 'rgba(255, 255, 255, 0.7)',
                            },
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          name="email"
                          label="Your Email"
                          type="email"
                          value={formData.email}
                          onChange={handleChange}
                          variant="outlined"
                          className="bg-gray-700/50 rounded-lg"
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: 'white',
                              '& fieldset': {
                                borderColor: 'rgba(147, 51, 234, 0.3)',
                              },
                              '&:hover fieldset': {
                                borderColor: 'rgba(147, 51, 234, 0.5)',
                              },
                              '&.Mui-focused fieldset': {
                                borderColor: '#9333ea',
                              },
                            },
                            '& .MuiInputLabel-root': {
                              color: 'rgba(255, 255, 255, 0.7)',
                            },
                          }}
                        />
                      </Grid>
                    </Grid>
                    <TextField
                      fullWidth
                      name="subject"
                      label="Subject"
                      value={formData.subject}
                      onChange={handleChange}
                      variant="outlined"
                      className="bg-gray-700/50 rounded-lg"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          color: 'white',
                          '& fieldset': {
                            borderColor: 'rgba(147, 51, 234, 0.3)',
                          },
                          '&:hover fieldset': {
                            borderColor: 'rgba(147, 51, 234, 0.5)',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#9333ea',
                          },
                        },
                        '& .MuiInputLabel-root': {
                          color: 'rgba(255, 255, 255, 0.7)',
                        },
                      }}
                    />
                    <TextField
                      fullWidth
                      name="message"
                      label="Your Message"
                      multiline
                      rows={6}
                      value={formData.message}
                      onChange={handleChange}
                      variant="outlined"
                      className="bg-gray-700/50 rounded-lg"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          color: 'white',
                          '& fieldset': {
                            borderColor: 'rgba(147, 51, 234, 0.3)',
                          },
                          '&:hover fieldset': {
                            borderColor: 'rgba(147, 51, 234, 0.5)',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#9333ea',
                          },
                        },
                        '& .MuiInputLabel-root': {
                          color: 'rgba(255, 255, 255, 0.7)',
                        },
                      }}
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-10 py-4 rounded-full text-white font-semibold shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:scale-105"
                    >
                      Send Message
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>

          <Grid item xs={12} md={4}>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              {contactInfo.map((info, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.05, y: -5 }}
                >
                  <Card className="glass-effect hover-lift cursor-pointer">
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-4">
                        <motion.div 
                          className="p-3 bg-purple-600/20 rounded-full"
                          whileHover={{ rotate: 360 }}
                          transition={{ duration: 0.6 }}
                        >
                          {info.icon}
                        </motion.div>
                        <div>
                          <Typography variant="h6" className="text-white font-semibold">
                            {info.title}
                          </Typography>
                          <Typography variant="body2" className="text-gray-400">
                            <a href={info.link} className="hover:text-purple-400 transition-colors duration-300">
                              {info.value}
                            </a>
                          </Typography>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}

              <Card className="glass-effect hover-lift">
                <CardContent className="p-6">
                  <Typography variant="h6" className="text-white font-semibold mb-4 text-center">
                    Follow Me
                  </Typography>
                  <div className="flex justify-center space-x-4">
                    {socialLinks.map((social, index) => (
                      <motion.div
                        key={index}
                        whileHover={{ scale: 1.2, rotate: 10 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <IconButton
                          href={social.link}
                          className="text-gray-400 hover:text-purple-400 transition-all duration-300 hover:bg-white/10"
                          aria-label={social.label}
                        >
                          {social.icon}
                        </IconButton>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        </Grid>
      </Container>
    </section>
  );
};

export default Contact;
